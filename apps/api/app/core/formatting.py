"""Locale-independent number formatting for Vietnamese display text."""


def format_number_vi(value: int | float, *, decimals: int = 0, signed: bool = False) -> str:
    """Use decimal commas and thousands dots without changing numeric API values."""
    spec = f"{'+' if signed else ''},.{decimals}f"
    return format(value, spec).translate(str.maketrans(",.", ".,"))
