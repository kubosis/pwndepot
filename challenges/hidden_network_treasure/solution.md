Solution steps (for graders):

1. Run the challenge container with the environment variable CTF_FLAG set, or generate the pcap locally:
   - Locally: export CTF_FLAG='flag{your_test_flag}'; ./generate_pcap.sh
2. Open network_capture.pcap in Wireshark.
3. Select the packet, open Packet Bytes (bottom pane) and copy the hex or ASCII payload.
4. Convert hex -> ascii -> base64 -> decode, e.g.:
   - Hex -> ascii -> Base64 string -> decode
   - Example commands:
     xxd -p -r -c 256 payload.hex | base64 --decode
   - Or PowerShell:
     $hex = "5a6d..."; $bytes = for ($i=0; $i -lt $hex.Length; $i+=2) { [Convert]::ToByte($hex.Substring($i,2),16) }; [System.Text.Encoding]::ASCII.GetString($bytes) | % { [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($_)) }

The final output is: flag{hihihihaa}
