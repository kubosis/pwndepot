from kubernetes import client, config

config.load_kube_config()

v1 = client.CoreV1Api()
print("Listing nodes from Python:")
for node in v1.list_node().items:
    print(f"- {node.metadata.name}")
