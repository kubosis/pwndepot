# Hidden Network Treasure (Medium)

## What the player sees
The challenge runs as a web instance. The page offers a downloadable PCAP:
- `GET /network_capture.pcap`

## Goal
1. Download `network_capture.pcap`.
2. Open it in Wireshark / analyze with tshark.
3. Extract the hidden payload (it is a Base64 string inside packet bytes).
4. Decode the Base64 to obtain the flag in `xxxxxxxx` format.

## Notes for the platform/admin
- The PCAP is generated **at container startup**.
- The flag must be provided via environment variable: `CTF_FLAG`.
- The container serves the file over HTTP on port **8000**.

## Player hints
- Check *Packet Bytes* in Wireshark.
- Try "Follow TCP Stream" (or inspect the payload bytes directly).
- The hidden data is Base64; decoding reveals the flag.
