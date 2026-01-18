# Hidden Network Treasure (Medium)

You are given a network capture file `network_capture.pcap`. A secret flag is hidden inside the packet payload.
Your task:
1. Analyze the pcap (Wireshark / tshark).
2. Find and extract the hidden payload (it contains a Base64 string).
3. Decode the Base64 to obtain the flag in `flag{...}` format.

Hints:
- Check Packet Bytes or use "Follow TCP Stream".
- The flag is encoded (Base64) within one payload.