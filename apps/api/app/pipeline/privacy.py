"""M0 anonymisation: mask Vietnamese phone numbers as [SĐT] (pipeline-xu-ly §M0).

9-11 digits starting with 0 or +84, possibly split by spaces, dots or dashes ("09xx xxx xxx").
The extension masks first; the server masks again before anything is stored.
"""
import re

PHONE_TOKEN = "[SĐT]"

_PHONE_RE = re.compile(
    r"(?<![\d+])"
    r"(?:\+\s?84|0)"           # country code or trunk prefix
    r"(?:[\s.\-]{0,2}\d){8,10}"  # remaining 8-10 digits with optional separators
    r"(?!\d)"
)


def mask_phones(text: str) -> str:
    return _PHONE_RE.sub(PHONE_TOKEN, text)


def has_unmasked_phone(text: str) -> bool:
    return _PHONE_RE.search(text) is not None
