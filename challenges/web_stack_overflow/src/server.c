#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <netinet/in.h>

void win() {
    system("echo $CTF_FLAG");
}

void vulnerable(char *input) {
    char buffer[64];
    strcpy(buffer, input);   // INTENTIONAL VULNERABILITY
}

int main() {
    int server_fd, client_fd;
    struct sockaddr_in addr;
    char request[1024];

    server_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (server_fd < 0) {
        perror("socket");
        exit(1);
    }

    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = INADDR_ANY;
    addr.sin_port = htons(8080);

    bind(server_fd, (struct sockaddr*)&addr, sizeof(addr));
    listen(server_fd, 5);

    printf("Listening on port 8080...\n");

    client_fd = accept(server_fd, NULL, NULL);
    read(client_fd, request, sizeof(request));

    
    char *body = strstr(request, "\r\n\r\n");
    if (body) {
        body += 4;
        vulnerable(body);
    }

    write(client_fd,
          "HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nOK",
          44);

    close(client_fd);
    close(server_fd);
    return 0;
}
