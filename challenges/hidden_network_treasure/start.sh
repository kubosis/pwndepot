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
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;max-width:760px;margin:40px auto;padding:0 16px;line-height:1.5}
    code,pre{background:#f6f8fa;padding:2px 6px;border-radius:6px}
    pre{padding:12px;overflow:auto}
    a{color:#0969da}
  </style>
</head>
<body>
  <h1>Hidden Network Treasure</h1>
  <p>Download the capture and find the hidden Base64 payload. Decoding it reveals the flag.</p>
  <p><a href="/network_capture.pcap">Download network_capture.pcap</a></p>
  <h2>Tips</h2>
  <ul>
    <li>Wireshark: open the PCAP and inspect packet bytes / follow stream.</li>
    <li>The payload contains a Base64 string. Decode it to get <code>flag{...}</code>.</li>
  </ul>
</body>
</html>
HTML

cd "$OUTDIR"
exec python3 -m http.server 8000 --bind 0.0.0.0
