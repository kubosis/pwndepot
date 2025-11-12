# gen_pub.py  — génère pub.json avec p~q (Fermat facile) et n > int(FLAG)
import os, json, random

# Miller–Rabin deterministe pour <= 2^128
def is_probable_prime(n):
    if n < 2: return False
    small = [2,3,5,7,11,13,17,19,23,29,31]
    for p in small:
        if n % p == 0:
            return n == p
    d = n - 1
    s = 0
    while d % 2 == 0:
        d //= 2
        s += 1
    # Bases suffisantes pour 128 bits
    for a in (2, 3, 5, 7, 11, 13, 17):
        if a >= n: 
            continue
        x = pow(a, d, n)
        if x == 1 or x == n-1:
            continue
        for _ in range(s-1):
            x = (x*x) % n
            if x == n-1:
                break
        else:
            return False
    return True

def next_prime_near(x):
    if x % 2 == 0: x += 1
    while not is_probable_prime(x):
        x += 2
    return x

def gen_close_primes(bits=72, gap_max=(1<<16)):
    base = (1 << (bits - 1)) + random.getrandbits(bits - 2)
    p = next_prime_near(base)
    q = next_prime_near(p + random.randint(2, gap_max))
    return p, q

def flag_int_from_env():
    flag = os.environ.get("FLAG", "FLAG{local_test}").encode("utf-8")
    return int.from_bytes(flag, "big")

def main():
    E = 65537
    flag_int = flag_int_from_env()

    # Boucle jusqu’à n > FLAG et p~q
    while True:
        p, q = gen_close_primes(bits=72)   # ~72b -> n ~144b (assez pour FLAG{local_test})
        n = p * q
        if n > flag_int:
            break

    with open("pub.json", "w", encoding="utf-8") as f:
        json.dump({"n": str(n), "e": str(E)}, f, indent=2)

    print("OK pub.json")
    print("bits(n) =", n.bit_length())
    print("p =", p)
    print("q =", q)

if __name__ == "__main__":
    main()
