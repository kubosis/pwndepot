set -eu

OUTDIR="/challenges/hidden_network_treasure"
mkdir -p "$OUTDIR"

OUTPCAP="$OUTDIR/network_capture.pcap"
TMPBASE="$OUTDIR/flag_base64.txt"
TMPHEX="$OUTDIR/flag_hex.txt"

if [ -z "${CTF_FLAG:-}" ]; then
  echo "CTF_FLAG is not set. Writing placeholder pcap."
  echo "0000: 50 4c 41 43 45 48 4f 4c 44" > "$TMPHEX"
  text2pcap -l 101 "$TMPHEX" "$OUTPCAP" || true
  exit 0
fi

if [[ "${CTF_FLAG}" == flag\{*\} ]]; then
  FINAL_FLAG="${CTF_FLAG}"
else
  FINAL_FLAG="flag{${CTF_FLAG}}"
fi

echo -n "${FINAL_FLAG}" | base64 -w 0 > "$TMPBASE"

hex=$(xxd -p -c 256 "$TMPBASE" | tr -d '\n' | sed 's/../& /g')
echo "0000: $hex" > "$TMPHEX"

text2pcap -l 101 "$TMPHEX" "$OUTPCAP"
echo "Generated $OUTPCAP"
