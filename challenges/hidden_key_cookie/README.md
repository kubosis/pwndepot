A web challenge: the secret is hidden in the image metadata. Use it to craft a valid session cookie for `admin` and access `/flag`.

Hints:
- Inspect the PNG metadata (look for textual metadata).
- Signature is HMAC-SHA256(username, secret).
- Cookie format: `session=USERNAME|HEX_SIGNATURE`

Two quick methods:
1. Browser (DevTools Console):
   ```js
   document.cookie = "session=admin|<HEXSIG>; path=/";
   location.href = "/flag";
   ```
2. Terminal (curl):
   ```bash
   curl -sS -H "Cookie: session=admin|<HEXSIG>" http://localhost:5000/flag
   ```
