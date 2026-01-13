# python
import asyncio
import secrets
import string
from threading import Lock

from kubernetes import client
from kubernetes.client.rest import ApiException
from loguru import logger

from app.backend.config.settings import get_settings
from app.backend.utils.flag_store import RedisFlagStore
from app.backend.utils.redis_bus import RedisBus

settings = get_settings()


class K8sChallengeManager:
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

    def spawn_instance(
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
        self.flag_store.set_flag(user_id, challenge_id, flag_value, ttl_seconds=settings.CHALLENGE_K8S_POD_TTL_SECONDS)

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
            logger.error(f"K8s API Error: {e}")
            return None

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
