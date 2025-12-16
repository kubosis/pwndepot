\# Hard RSA Full



\## Category

Crypto



\## Author

Rn7595 Navin



\## Points

500



---



\## Description



This challenge provides a full RSA encryption service.

The player can query two endpoints:



\- `GET /pub` → returns the RSA public key (`n`, `e`)

\- `GET /cipher` → returns the ciphertext of the secret FLAG encrypted with the server’s RSA key



The FLAG is loaded into the container through the `.env` file at runtime.

No other hints are provided.



Players must analyze the RSA parameters, retrieve the flag from the ciphertext, and provide the final flag.



---



\## Challenge Structure



The challenge is located in:



Challenges/hard\_rsa\_full/



It contains:



\- `server/app.py` — Flask service implementing `/pub` and `/cipher`

\- `pub.json` — JSON file containing the RSA public key used by the service

\- `docker-compose.yml` — launches the service on port 9001

\- `.env.example` — placeholder for defining the `FLAG`

\- `.gitignore` — excludes private environment files



---



\## Notes



\- No solver or solution is included in the challenge directory.

\- No hints are provided to players.

\- This challenge only contains the infrastructure code needed to run the CTF service.

\- The actual FLAG must be placed by the CTF platform during deployment.

