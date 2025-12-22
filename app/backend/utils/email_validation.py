import dns.resolver

TRUSTED_EMAIL_DOMAINS = {
    # Google
    "gmail.com",
    # Microsoft
    "outlook.com",
    "hotmail.com",
    "hotmail.co.uk",
    "hotmail.fr",
    "hotmail.de",
    "live.com",
    "msn.com",
    # Yahoo
    "yahoo.com",
    "yahoo.co.uk",
    "yahoo.fr",
    "yahoo.de",
    "yahoo.es",
    "yahoo.it",
    "yahoo.ca",
    "yahoo.com.au",
    "yahoo.co.jp",
    "yahoo.co.in",
    "yahoo.com.br",
    # Apple
    "icloud.com",
    "me.com",
    "mac.com",
    # Proton
    "proton.me",
    "protonmail.com",
    # Zoho
    "zoho.com",
    "zohomail.com",
    # GMX / Mail.com
    "gmx.com",
    "gmx.net",
    "gmx.de",
    "gmx.at",
    "mail.com",
    # AOL
    "aol.com",
    # Fastmail
    "fastmail.com",
    "fastmail.fm",
    # Tutanota
    "tutanota.com",
    "tutanota.de",
    # tuta.com,
    "tuta.io",
    # Yandex
    "yandex.com",
    "yandex.ru",
    "yandex.ua",
    "yandex.kz",
    # Mail.ru
    "mail.ru",
    "inbox.ru",
    "list.ru",
    "bk.ru",
    # EU
    "web.de",
    "t-online.de",
    "freenet.de",
    "arcor.de",
    "orange.fr",
    "wanadoo.fr",
    "free.fr",
    "laposte.net",
    "libero.it",
    "virgilio.it",
    "alice.it",
    "tin.it",
    "telefonica.net",
    "terra.es",
    "ya.com",
    "wp.pl",
    "onet.pl",
    "interia.pl",
    "o2.pl",
    "seznam.cz",
    "centrum.cz",
    "email.cz",
    "azet.sk",
    "abv.bg",
    "ukr.net",
    "i.ua",
    # USA ISP
    "comcast.net",
    "verizon.net",
    "att.net",
    "cox.net",
    "charter.net",
    "sbcglobal.net",
    # UK
    "btinternet.com",
    "sky.com",
    "virginmedia.com",
    "ntlworld.com",
    "talktalk.net",
    # Canada
    "rogers.com",
    "bell.net",
    # Australia
    "bigpond.com",
    "optusnet.com.au",
    # Asia
    "gmail.co.jp",
    "docomo.ne.jp",
    "ezweb.ne.jp",
    "naver.com",
    "daum.net",
    "rediffmail.com",
    "gmail.co.in",
    # South America
    "uol.com.br",
    "bol.com.br",
    "terra.com.br",
}


def is_trusted_email(email: str) -> bool:
    domain = email.split("@")[-1].lower()
    return domain in TRUSTED_EMAIL_DOMAINS


def has_mx_record(domain: str) -> bool:
    try:
        dns.resolver.resolve(domain, "MX")
        return True
    except Exception:
        return False
