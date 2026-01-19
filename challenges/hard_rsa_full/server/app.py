from flask import Flask, jsonify
import os, json, pathlib

app = Flask(__name__)

# pub.json est un dossier au-dessus de /server
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
    # Backend injecte CTF_FLAG. En local tu peux utiliser FLAG.
    flag = os.getenv("CTF_FLAG") or os.getenv("FLAG") or "FLAG{local_test}"

    msg = flag.encode("utf-8")
    m = bytes_to_int(msg)

    # IMPORTANT: pas de troncature (sinon deux flags peuvent donner le même cipher)
    if m >= N:
        return jsonify({"error": "FLAG too long for this modulus"}), 500

    c = pow(m, E, N)
    return jsonify({"cipher": str(c)})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
