"""Vietnamese display numbers use decimal commas and thousands dots."""
import pytest


@pytest.mark.parametrize("value,decimals,expected", [
    (1.5, 1, "1,5"),
    (4_400_000, 0, "4.400.000"),
])
def test_format_number_vi(value, decimals, expected):
    from app.core.formatting import format_number_vi

    assert format_number_vi(value, decimals=decimals) == expected
