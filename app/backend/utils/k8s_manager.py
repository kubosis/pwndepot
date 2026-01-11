from threading import Lock

from kubernetes import client
from kubernetes.client.rest import ApiException
from loguru import logger

from app.backend.config.settings import get_settings

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
        self._initialized = True
        logger.info("K8sChallengeManager initialized")

    def get_pod_name(self, user_id: int, challenge_id: int) -> str:
        return f"chal-u{user_id}-c{challenge_id}"

    def spawn_instance(self, user_id: int, challenge_id: int, image: str, port: int) -> str | None:
        """
        Creates a Pod and a Service for the user.
        Returns the connection info (DNS or IP).
        """
        name = self.get_pod_name(user_id, challenge_id)
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
                        # limit the resources
                        resources=client.V1ResourceRequirements(limits={"memory": "64Mi", "cpu": "200m"}),
                    )
                ],
                restart_policy="Never",
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

            # Return internal cluster DNS.
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
            if e.status != 404:
                logger.error(f"Failed to terminate {name}: {e}")
