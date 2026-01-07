from flask import Flask, request, send_from_directory, render_template_string
import hmac, hashlib, os
from PIL import Image

app = Flask(__name__)


def get_secret_from_png():
    try:
        im = Image.open("static/logo.png")
        return im.info.get("ctf_key")
    except Exception:
        return None


def sign(username, key):
    return hmac.new(key.encode(), username.encode(), hashlib.sha256).hexdigest()


INDEX_HTML = """
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Hidden Key Cookie Forge — ISEP CTF</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { font-family: Arial, Helvetica, sans-serif; background: #f7f7fb; color:#111; margin:0; padding:0; }
      .container { max-width:900px; margin:40px auto; padding:30px; background:white; border-radius:12px; box-shadow:0 8px 30px rgba(0,0,0,0.06); }
      h1 { margin:0 0 12px; font-size:28px; text-align:center; }
      p.lead { text-align:center; color:#444; margin-bottom:24px; }
      .img-wrap { text-align:center; margin: 20px 0; }
      img.logo { max-width:80%; height:auto; border-radius:8px; box-shadow:0 6px 18px rgba(0,0,0,0.08); }
      .instructions { margin-top:18px; padding:18px; background:#fafafa; border-radius:8px; color:#333; }
      .download { text-align:center; margin-top:14px; }
      .btn { background:#1e88e5; color:white; padding:10px 16px; border-radius:6px; text-decoration:none; display:inline-block; }
      footer { text-align:center; margin-top:18px; color:#888; font-size:13px; }
      code { background:#efefef; padding:2px 6px; border-radius:4px; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Hidden Key Cookie Forge</h1>
      <p class="lead">A Web based CTF challenge — find the secret hidden in the image to craft a valid session cookie.</p>
      <div class="img-wrap">
        <img class="logo" src="/static/logo.png" alt="Downloadable image">
      </div>
      <div class="download">
        <a class="btn" href="/static/logo.png" download>Download the image</a>
      </div>

      <div class="instructions">
        <strong>How to approach (high level):</strong>
        <ol>
          <li>Download the image and inspect its metadata (hint: PNG text chunk).</li>
          <li>Compute an HMAC-SHA256 signature of the username <code>admin</code> using the secret you found.</li>
          <li>Set a cookie <code>session=admin|&lt;signature&gt;</code> and open <code>/flag</code>.</li>
        </ol>
        <p style="margin:6px 0 0;"><em>Use browser DevTools or curl. Good luck — be curious!</em></p>
      </div>

      <footer>Happy hacking — ISEP CTF</footer>
    </div>
  </body>
</html>
"""


@app.route("/")
def index():
    return render_template_string(INDEX_HTML)


@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory("static", filename)


@app.route("/flag")
def flag():
    # session format: username|hexsig
    sess = request.cookies.get("session", "")
    if "|" not in sess:
        return "Invalid session cookie", 400
    username, provided = sess.split("|", 1)

    key = get_secret_from_png()
    if not key:
        return "Server misconfigured (no key)", 500

    expected = sign(username, key)
    if hmac.compare_digest(expected, provided) and username == "admin":
        # default flag if CTF_FLAG not provided
        return os.environ.get("CTF_FLAG", "ISEP{You_f0und_th3_s3cr3t!}")
    return "Access denied", 403


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
