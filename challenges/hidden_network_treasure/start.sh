set -euo pipefail

OUTDIR="/challenges/hidden_network_treasure"

/usr/local/bin/generate_pcap.sh

cat > "$OUTDIR/index.html" <<'HTML'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Hidden Network Treasure</title>

  <style>
    :root{
      --bg1:#07110c;
      --bg2:#050c09;
      --panel:rgba(10,24,16,.78);
      --border:rgba(80,255,170,.18);
      --text:rgba(235,255,245,.92);
      --muted:rgba(235,255,245,.68);
      --green:#40f99b;
    }

    *{box-sizing:border-box}

    html,body{
      width:100%;
      height:100%;
      margin:0;
    }

    body{
      display:flex;
      align-items:center;
      justify-content:center;
      font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;
      color:var(--text);

      /* egységes háttér, nincs "kettétörés" */
      background:
        radial-gradient(900px 600px at 50% 20%, rgba(64,249,155,.14), transparent 60%),
        linear-gradient(180deg, var(--bg1), var(--bg2));
    }

    .card{
      width:100%;
      max-width:760px;
      padding:28px;
      border-radius:18px;
      background:var(--panel);
      border:1px solid var(--border);
      box-shadow:0 18px 50px rgba(0,0,0,.55);
      backdrop-filter: blur(12px);
    }

    h1{
      margin:0 0 10px 0;
      font-size:30px;
      letter-spacing:.2px;
    }

    p{
      margin:0 0 14px 0;
      color:var(--muted);
      line-height:1.55;
    }

    .btn{
      display:inline-flex;
      align-items:center;
      gap:10px;
      padding:12px 16px;
      border-radius:14px;
      border:1px solid rgba(64,249,155,.35);
      background:linear-gradient(180deg, rgba(32,196,122,.22), rgba(32,196,122,.10));
      color:var(--text);
      text-decoration:none;
      font-weight:700;
      box-shadow:0 10px 30px rgba(0,0,0,.35);
      transition:transform .12s ease, border-color .12s ease;
      margin:6px 0 10px 0;
    }

    .btn:hover{
      transform:translateY(-1px);
      border-color:rgba(64,249,155,.55);
    }

    .tag{
      font-size:12px;
      padding:2px 8px;
      border-radius:999px;
      border:1px solid rgba(80,255,170,.22);
      color:var(--muted);
    }

    hr{
      margin:14px 0;
      border:none;
      height:1px;
      background:rgba(80,255,170,.16);
    }

    h2{
      margin:14px 0 8px 0;
      font-size:22px;
    }

    ul{
      margin:6px 0 0 18px;
      color:var(--muted);
    }

    code{
      background:rgba(0,0,0,.28);
      padding:2px 6px;
      border-radius:8px;
      color:var(--text);
    }
  </style>
</head>

<body>
  <div class="card">
    <h1>Hidden Network Treasure</h1>

    <p>
      Download the capture and find the hidden Base64 payload.
      Decoding it reveals the flag.
    </p>

    <a class="btn" href="network_capture.pcap">
      Download network_capture.pcap <span class="tag">PCAP</span>
    </a>

    <hr>

    <p>
      <strong>If the download link does not work:</strong>
      Append <code>/network_capture.pcap</code> to the instance URL in your browser.
    </p>

    <h2>Tips</h2>
    <ul>
      <li>Wireshark: open the PCAP and inspect packet bytes.</li>
      <li>The payload contains a Base64 string. Decode it to get <code>flag{...}</code>.</li>
    </ul>
  </div>
</body>
</html>
HTML

cd "$OUTDIR"
exec python3 -m http.server 8000 --bind 0.0.0.0
