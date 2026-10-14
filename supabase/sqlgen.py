"""Helpers for generating SQL that no clipboard or codepage can damage.

Every file these produce is **pure ASCII**:

  - a text value with non-ASCII characters is emitted as
    `convert_from(decode('<base64>','base64'),'UTF8')`
  - jsonb uses JSON's own \\uXXXX escapes (json.dumps with ensure_ascii=True),
    which Postgres parses natively

This is not paranoia. Pasting the UTF-8 version of these migrations through the
Windows clipboard wrote mojibake into the live database: "Baraja espanola"
arrived as "Baraja espa|-+-ola", "Poker ... hold'em" lost its apostrophe, and the
card suits ♠♣♥♦ became three garbage characters each. ASCII-only output removes
the failure mode instead of asking anyone to remember an encoding flag.
"""
import base64
import json


def lit(value: str | None) -> str:
    """A text literal: readable when it can be, base64 when it must be."""
    if value is None:
        return "null"
    if value.isascii():
        return "'" + value.replace("'", "''") + "'"
    encoded = base64.b64encode(value.encode("utf-8")).decode("ascii")
    return f"convert_from(decode('{encoded}','base64'),'UTF8')"


def jsonb(value) -> str:
    """A jsonb literal, with non-ASCII as \\uXXXX so the text stays ASCII."""
    dumped = json.dumps(value, ensure_ascii=True, separators=(",", ":"))
    assert dumped.isascii()
    return "'" + dumped.replace("'", "''") + "'::jsonb"


def text_array(values: list[str]) -> str:
    if not values:
        return "array[]::text[]"
    return "array[" + ", ".join(lit(v) for v in values) + "]::text[]"


def assert_ascii(path, text: str) -> None:
    bad = sorted({c for c in text if ord(c) > 127})
    if bad:
        raise SystemExit(f"{path}: generated SQL is not ASCII: {bad!r}")
