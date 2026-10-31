"""OAuth callback inputs are secrets and never appear in validation representations."""
from pydantic import BaseModel, ConfigDict, Field


class GoogleCallback(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(min_length=1, max_length=4096, repr=False)
    state: str = Field(min_length=1, max_length=200, repr=False)


class GoogleStart(BaseModel):
    authorization_url: str


class GoogleComplete(BaseModel):
    next: str
