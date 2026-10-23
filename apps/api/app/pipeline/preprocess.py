"""M1 preprocessing: a matching view of the post text that maps back to code points.

`post.text` is never modified. We build two views of equal length:
- `lower`: NFC + lowercase (accents kept) for rules that need Vietnamese diacritics;
- `folded`: `lower` without diacritics, `đ` -> `d`, so "phòng" and "phong" match the same rule.
`src[i]` is the code point range in `post.text` that produced view character `i`.
"""
from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import dataclass

_SPACE_RE = re.compile(r"\s+")


def _fold_char(ch: str) -> str:
    if ch in "đĐ":
        return "d"
    base = [c for c in unicodedata.normalize("NFD", ch) if not unicodedata.combining(c)]
    return base[0] if base else ch


@dataclass
class TextView:
    text: str
    lower: str
    folded: str
    src: list[tuple[int, int]]

    @classmethod
    def build(cls, text: str) -> "TextView":
        lower_chars: list[str] = []
        src: list[tuple[int, int]] = []
        i = 0
        n = len(text)
        while i < n:
            j = i + 1
            while j < n and unicodedata.combining(text[j]):
                j += 1
            for ch in unicodedata.normalize("NFC", text[i:j]):
                low = ch.lower()
                lower_chars.append(low if len(low) == 1 else ch)
                src.append((i, j))
            i = j
        lower = "".join(lower_chars)
        folded = "".join(_fold_char(c) for c in lower)
        return cls(text=text, lower=lower, folded=folded, src=src)

    def to_source(self, start: int, end: int) -> tuple[int, int]:
        """View range [start, end) -> code point range on the original text."""
        return self.src[start][0], self.src[end - 1][1]

    def quote(self, start: int, end: int) -> tuple[int, int, str]:
        s, e = self.to_source(start, end)
        return s, e, self.text[s:e]


def fold(text: str) -> str:
    """Folded form of an arbitrary string (used for quotes and keyword lists)."""
    return TextView.build(text).folded


def text_hash(text: str) -> str:
    """sha256 of the normalized text (NFC, lowercase, collapsed spaces) for post-level dedup."""
    norm = _SPACE_RE.sub(" ", unicodedata.normalize("NFC", text).lower()).strip()
    return hashlib.sha256(norm.encode("utf-8")).hexdigest()


TOKEN_RE = re.compile(r"\w+|[^\w\s]", re.UNICODE)


def tokenize(text: str) -> list[tuple[int, int, str]]:
    """Fixed tokenizer shared by Lab BIO view and evaluation: words and single punctuation marks."""
    return [(m.start(), m.end(), m.group()) for m in TOKEN_RE.finditer(text)]
