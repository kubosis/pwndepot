FROM debian:12-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends nginx ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /opt/challenge

COPY . /opt/challenge/


# Copy it directly into the Nginx web root so that it can be accessed from the root in the browser.
RUN cp -r /opt/challenge/* /var/www/html/

CMD ["nginx", "-g", "daemon off;"]
