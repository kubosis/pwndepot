# python
import asyncio
import contextlib
import secrets
import string
from threading import Lock

from kubernetes import client
from kubernetes.client.rest import ApiException
from loguru import logger

from app.backend.config.settings import get_settings
from app.backend.utils.flag_store import RedisFlagStore, TeamFlagStore
from app.backend.utils.redis_bus import RedisBus

settings = get_settings()


class K8sChallengeManager:
    _instance = None
    _lock = Lock()

    def __new__(cls):
        # double - check pattern not to lock threads
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        # Only initialize once
        if hasattr(self, "_initialized"):
            logger.debug("K8sChallengeManager already exists... reusing the instance")
            return

        settings.load_k8s_config()
        self.core_v1 = client.CoreV1Api()
        self.namespace = settings.K8S_CHALLENGE_NAMESPACE
        self.flag_store = RedisFlagStore()
        self._initialized = True
        logger.info("K8sChallengeManager initialized")

    def get_pod_name(self, user_id: int, challenge_id: int) -> str:
        return f"chal-u{user_id}-c{challenge_id}"

    def _gen_flag(self, length: int = 8) -> str:
        alphabet = string.ascii_letters + string.digits
        return "".join(secrets.choice(alphabet) for _ in range(length))

    async def spawn_instance(
        self, user_id: int, challenge_id: int, image: str, port: int, ttl_seconds: int = 3600
    ) -> str | None:
        """
        Creates a Pod and a Service for the user.
        Injects CTF_FLAG (random 8 chars) into the container env and publishes the flag to Redis.
        Returns the connection info (DNS or IP).
        Pod will have active_deadline_seconds set to ttl_seconds (best-effort).
        """
        name = self.get_pod_name(user_id, challenge_id)
        flag_value = self._gen_flag(8)
        await self.flag_store.set_flag(
            user_id, challenge_id, flag_value, ttl_seconds=settings.CHALLENGE_K8S_POD_TTL_SECONDS
        )

        pod_manifest = client.V1Pod(
            metadata=client.V1ObjectMeta(
                name=name, labels={"app": "ctf-challenge", "user": str(user_id), "challenge": str(challenge_id)}
            ),
            spec=client.V1PodSpec(
                containers=[
                    client.V1Container(
                        name="challenge",
                        image=image,
                        ports=[client.V1ContainerPort(container_port=port)],
                        env=[client.V1EnvVar(name="CTF_FLAG", value=flag_value)],
                        resources=client.V1ResourceRequirements(limits={"memory": "64Mi", "cpu": "200m"}),
                    )
                ],
                restart_policy="Never",
                active_deadline_seconds=ttl_seconds,  # kill pod after TTL
            ),
        )
        service_manifest = client.V1Service(
            metadata=client.V1ObjectMeta(name=name, labels={"app": "ctf-challenge"}),
            spec=client.V1ServiceSpec(
                selector={"app": "ctf-challenge", "user": str(user_id), "challenge": str(challenge_id)},
                ports=[client.V1ServicePort(port=port, target_port=port)],
                type="ClusterIP",
            ),
        )

        try:
            self.core_v1.create_namespaced_pod(namespace=self.namespace, body=pod_manifest)
            self.core_v1.create_namespaced_service(namespace=self.namespace, body=service_manifest)

            logger.info(f"Spawned challenge {name} for user {user_id}")

            # publish flag to redis bus as a background task
            async def _publish_flag():
                try:
                    bus = RedisBus(settings.REDIS_URL)
                    await bus.publish(
                        "challenge_flag",
                        {
                            "user_id": user_id,
                            "challenge_id": challenge_id,
                            "flag": flag_value,
                            "service": name,
                            "port": port,
                        },
                    )
                    await bus.close()
                except Exception as e:
                    logger.error(f"Failed to publish flag for {name}: {e}")

            try:
                loop = asyncio.get_running_loop()
                loop.create_task(_publish_flag())  # noqa
            except RuntimeError:
                # no running loop in this context; best-effort schedule
                try:
                    asyncio.create_task(_publish_flag())  # noqa
                except Exception:
                    # if scheduling fails, log but continue
                    logger.warning("Could not schedule redis publish task for flag")

            return f"{name}.{self.namespace}.svc.cluster.local:{port}"

        except ApiException as e:
            if e.status == 409:  # Conflict (Already Exists)
                print(f"Pod {name} already exists.")
                existing_pod = self.core_v1.read_namespaced_pod(name, self.namespace)

                if existing_pod.status.phase in ["Succeeded", "Failed"]:
                    print(f"Deleting dead pod {name}...")
                    self.core_v1.delete_namespaced_pod(name, self.namespace)
                    return await self.spawn_instance(user_id, challenge_id, image, port, ttl_seconds)
                return existing_pod.status.pod_ip
            else:
                raise  # Re-raise other errors

    def terminate_instance(self, user_id: int, challenge_id: int):
        name = self.get_pod_name(user_id, challenge_id)
        try:
            self.core_v1.delete_namespaced_service(name=name, namespace=self.namespace)
            self.core_v1.delete_namespaced_pod(name=name, namespace=self.namespace)
            logger.info(f"Terminated challenge {name}")
        except ApiException as e:
            if getattr(e, "status", None) != 404:
                logger.error(f"Failed to terminate {name}: {e}")

    def schedule_termination(
        self, user_id: int, challenge_id: int, ttl_seconds: int = settings.CHALLENGE_K8S_POD_TTL_SECONDS
    ) -> None:
        """
        Schedule server-side termination as a fallback after ttl_seconds.
        """

        async def _delayed_terminate():
            try:
                await asyncio.sleep(ttl_seconds)
                try:
                    self.terminate_instance(user_id, challenge_id)
                except Exception as exc:
                    logger.error(f"Scheduled termination failed for {self.get_pod_name(user_id, challenge_id)}: {exc}")
            except asyncio.CancelledError:
                logger.debug("Scheduled termination cancelled")

        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_delayed_terminate())  # noqa
        except RuntimeError:
            # No running loop — schedule via asyncio.create_task anyway (best-effort)
            asyncio.create_task(_delayed_terminate())  # noqa


class K8sTeamChallengeManager:
    """
    Team-scoped manager (add-on).
    - One pod/service per (team_id, challenge_id)
    - Injects one flag per team instance into env: CTF_FLAG
    - Keeps resources low
    """

    _instance = None
    _lock = Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if hasattr(self, "_initialized"):
            logger.debug("K8sTeamChallengeManager already exists... reusing the instance")
            return

        settings.load_k8s_config()
        self.core_v1 = client.CoreV1Api()
        self.namespace = settings.K8S_CHALLENGE_NAMESPACE
        self.flag_store = TeamFlagStore()
        self._initialized = True
        logger.info("K8sTeamChallengeManager initialized")

    def get_pod_name(self, team_id: int, challenge_id: int) -> str:
        # IMPORTANT: stable naming per team+challenge
        return f"chal-t{team_id}-c{challenge_id}"

    def _gen_flag(self, length: int = 8) -> str:
        alphabet = string.ascii_letters + string.digits
        return "".join(secrets.choice(alphabet) for _ in range(length))

    async def spawn_instance(
        self, team_id: int, challenge_id: int, image: str, port: int, ttl_seconds: int = 3600, protocol: str = "http"
    ) -> dict | None:
        """
        Creates a Pod and a Service for the team.
        Injects one CTF_FLAG per team instance and stores it under team scope in Redis.
        Returns connection string "<svc>.<ns>.svc.cluster.local:<port>"
        """
        name = self.get_pod_name(team_id, challenge_id)

        flag_value = self._gen_flag(8)
        passphrase = None

        if protocol == "tcp":
            from app.backend.utils.instance_token_store import InstanceTokenStore

            token_store = InstanceTokenStore()
            passphrase = token_store.new_passphrase(16)

        await self.flag_store.set_flag(
            team_id,
            challenge_id,
            flag_value,
            ttl_seconds=ttl_seconds,
        )

        env = [
            client.V1EnvVar(name="CTF_FLAG", value=flag_value),
        ]

        if passphrase:
            env.append(client.V1EnvVar(name="CTF_PASSPHRASE", value=passphrase))

        pod_manifest = client.V1Pod(
            metadata=client.V1ObjectMeta(
                name=name,
                labels={
                    "app": "ctf-challenge",
                    "team": str(team_id),
                    "challenge": str(challenge_id),
                },
            ),
            spec=client.V1PodSpec(
                containers=[
                    client.V1Container(
                        name="challenge",
                        image=image,
                        ports=[client.V1ContainerPort(container_port=port)],
                        env=env,
                        resources=client.V1ResourceRequirements(
                            limits={"memory": "512Mi", "cpu": "500m"}, requests={"memory": "256Mi", "cpu": "200m"}
                        ),
                    )
                ],
                restart_policy="Never",
                active_deadline_seconds=ttl_seconds,
            ),
        )

        # =============================
        # SERVICE: TCP = NodePort
        # =============================
        if protocol == "tcp":
            service_manifest = client.V1Service(
                metadata=client.V1ObjectMeta(
                    name=name,
                    labels={"app": "ctf-challenge"},
                ),
                spec=client.V1ServiceSpec(
                    selector={
                        "app": "ctf-challenge",
                        "team": str(team_id),
                        "challenge": str(challenge_id),
                    },
                    ports=[
                        client.V1ServicePort(
                            port=port,
                            target_port=port,
                            node_port=None,
                        )
                    ],
                    type="NodePort",
                ),
            )
        else:
            service_manifest = client.V1Service(
                metadata=client.V1ObjectMeta(
                    name=name,
                    labels={"app": "ctf-challenge"},
                ),
                spec=client.V1ServiceSpec(
                    selector={
                        "app": "ctf-challenge",
                        "team": str(team_id),
                        "challenge": str(challenge_id),
                    },
                    ports=[client.V1ServicePort(port=port, target_port=port)],
                    type="ClusterIP",
                ),
            )

        try:
            self.core_v1.create_namespaced_pod(
                namespace=self.namespace,
                body=pod_manifest,
            )

            svc = self.core_v1.create_namespaced_service(
                namespace=self.namespace,
                body=service_manifest,
            )

            tcp_port = None
            if protocol == "tcp":
                tcp_port = svc.spec.ports[0].node_port

            return {
                "protocol": protocol,
                "connection_internal": f"{name}.{self.namespace}.svc.cluster.local:{port}",
                "tcp_host": settings.PUBLIC_TCP_HOST if tcp_port else None,
                "tcp_port": tcp_port,
                "passphrase": passphrase,
            }

        except ApiException as e:
            if e.status == 409:  # Conflict (Already Exists)
                logger.warning(f"Zombie instance detected for {name}. Cleaning up and retrying...")
                # Best-effort delete of both Service and Pod
                try:
                    self.core_v1.delete_namespaced_service(name=name, namespace=self.namespace)
                except ApiException:
                    contextlib.suppress(ApiException)
                try:
                    self.core_v1.delete_namespaced_pod(name=name, namespace=self.namespace)
                except ApiException:
                    contextlib.suppress(ApiException)
                # Wait briefly for K8s to register the deletion
                await asyncio.sleep(3)
                # Retry the spawn
                return await self.spawn_instance(team_id, challenge_id, image, port, ttl_seconds, protocol)

            logger.error(f"K8s API Error: {e}")
            return None

    async def terminate_instance(self, team_id: int, challenge_id: int):
        name = self.get_pod_name(team_id, challenge_id)
        try:
            self.core_v1.delete_namespaced_service(name=name, namespace=self.namespace)
        except ApiException as e:
            if getattr(e, "status", None) != 404:
                raise
        try:
            self.core_v1.delete_namespaced_pod(name=name, namespace=self.namespace)
        except ApiException as e:
            if getattr(e, "status", None) != 404:
                raise

        await self.flag_store.delete_flag(team_id, challenge_id)
        logger.info(f"Terminated challenge {name}")
