FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      wireshark-common tshark xxd coreutils bash ca-certificates python3 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /challenges/hidden_network_treasure

COPY generate_pcap.sh /usr/local/bin/generate_pcap.sh
COPY start.sh /usr/local/bin/start.sh

RUN sed -i 's/\r$//' /usr/local/bin/generate_pcap.sh /usr/local/bin/start.sh && \
    chmod +x /usr/local/bin/generate_pcap.sh /usr/local/bin/start.sh

EXPOSE 8000

# The platform should set CTF_FLAG dynamically per instance/team.
CMD ["/bin/bash", "-lc", "/usr/local/bin/start.sh"]
