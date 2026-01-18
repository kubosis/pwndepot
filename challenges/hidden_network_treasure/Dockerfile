FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Telepítés
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      tshark xxd coreutils bash && \
    rm -rf /var/lib/apt/lists/*

# Munka könyvtár
WORKDIR /challenges/hidden_network_treasure

   
# Másoljuk be a scriptet
COPY generate_pcap.sh /usr/local/bin/generate_pcap.sh

# Futtathatóvá tesszük
RUN chmod +x /usr/local/bin/generate_pcap.sh

# Indításkor fusson a script, majd tartsa életben a konténert
CMD ["/bin/bash", "-c", "/usr/local/bin/generate_pcap.sh && sleep infinity"]

