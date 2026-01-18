FROM ubuntu:22.04

RUN apt update && apt install -y gcc make libc6-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /challenge

COPY src/ ./src/
RUN make -C src

RUN useradd -m ctf
USER ctf

ENV CTF_FLAG=FLAG{example_flag}

EXPOSE 8000


CMD ["./src/server"]
