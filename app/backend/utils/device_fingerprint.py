import hashlib


def build_device_fingerprint(request) -> str:
    ua = request.headers.get("user-agent", "")
    lang = request.headers.get("accept-language", "")
    platform = request.headers.get("sec-ch-ua-platform", "")

    ip = request.client.host if request.client else ""
    ip_prefix = ".".join(ip.split(".")[:3])

    raw = f"{ua}|{lang}|{platform}|{ip_prefix}"
    return hashlib.sha256(raw.encode()).hexdigest()
