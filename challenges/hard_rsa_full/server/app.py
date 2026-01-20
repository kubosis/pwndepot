from flask import Flask, jsonify
import os, json, pathlib

app = Flask(__name__)


@app.get("/")
def index():
    # Landing endpoint for the platform: provides relative endpoints (token-friendly)
    return jsonify({"name": "hard_rsa_full", "endpoints": ["pub", "cipher"]})


# pub.json is one directory above /server
pub_path = pathlib.Path(__file__).parent.parent / "pub.json"
with open(pub_path, "r", encoding="utf-8") as f:
    pub = json.load(f)

N = int(pub["n"])
E = int(pub["e"])


def bytes_to_int(b: bytes) -> int:
    return int.from_bytes(b, "big")


@app.get("/pub")
def get_pub():
    return jsonify({"n": str(N), "e": str(E)})


@app.get("/cipher")
def get_cipher():
    # Backend injects CTF_FLAG. Locally you can use FLAG.
    flag = os.getenv("CTF_FLAG") or os.getenv("FLAG") or "FLAG{local_test}"

    m = bytes_to_int(flag.encode("utf-8"))

    
    if m >= N:
        return jsonify({"error": "FLAG too long for this modulus"}), 500

    c = pow(m, E, N)
    return jsonify({"cipher": str(c)})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
