"""Password recovery bodies; secrets are excluded from object representations."""
from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator

from app.core.security import validate_password


class ForgotRequest(BaseModel):
    email: str = Field(max_length=254)


class ResetRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: str = Field(min_length=1, max_length=200, repr=False)
    password: str = Field(min_length=8, max_length=200, repr=False)
    confirm_password: str = Field(min_length=1, max_length=200, repr=False)

    @field_validator("password")
    @classmethod
    def strong_password(cls, value: str) -> str:
        return validate_password(value)

    @field_validator("confirm_password")
    @classmethod
    def matching_password(cls, value: str, info: ValidationInfo) -> str:
        if "password" in info.data and value != info.data["password"]:
            raise ValueError("Mật khẩu nhập lại chưa khớp")
        return value
