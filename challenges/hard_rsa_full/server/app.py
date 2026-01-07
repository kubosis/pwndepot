from flask import Flask, jsonify
import os, json, pathlib

app = Flask(__name__)

# pub.json est 1 dossier au-dessus de /server
pub_path = pathlib.Path(__file__).parent.parent / "pub.json"
with open(pub_path, "r", encoding="utf-8") as f:
    pub = json.load(f)

N = int(pub["n"])
E = int(pub["e"])


def rsa_encrypt(msg: bytes, n: int, e: int) -> int:
    m = int.from_bytes(msg, "big")
    if m >= n:
        max_len = max(1, (n.bit_length() // 8) - 1)
        msg = msg[:max_len]
        m = int.from_bytes(msg, "big")
    return pow(m, e, n)


@app.get("/pub")
def get_pub():
    return jsonify({"n": str(N), "e": str(E)})


@app.get("/cipher")
def get_cipher():
    flag = os.environ.get("FLAG", "FLAG{local_test}")
    c = rsa_encrypt(flag.encode("utf-8"), N, E)
    return jsonify({"cipher": str(c)})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
