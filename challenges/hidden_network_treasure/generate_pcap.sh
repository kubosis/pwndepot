#!/bin/sh
set -eu

OUTDIR="/challenges/hidden_network_treasure"
mkdir -p "$OUTDIR"
OUTPCAP="$OUTDIR/network_capture.pcap"
TMPBASE="$OUTDIR/flag_base64.txt"
TMPHEX="$OUTDIR/flag_hex.txt"

# Ensure CTF_FLAG exists
if [ -z "${CTF_FLAG:-}" ]; then
  echo "CTF_FLAG is not set. Writing placeholder pcap."
  echo "0000: 50 4c 41 43 45 48 4f 4c 44" > "$TMPHEX"
  # produce an empty or placeholder pcap (optional)
  text2pcap -l 101 "$TMPHEX" "$OUTPCAP" || true
  exit 0
fi

# 1) base64 encode the flag (no newline)
echo -n "$CTF_FLAG" | base64 > "$TMPBASE"

# 2) convert base64 ASCII to hex bytes and format "0000: <hex bytes>"
hex=$(xxd -p -c 256 "$TMPBASE" | tr -d '\n' | sed 's/../& /g')
echo "0000: $hex" > "$TMPHEX"

# 3) use text2pcap to create pcap (TCP)
text2pcap -l 101 "$TMPHEX" "$OUTPCAP"
echo "Generated $OUTPCAP"