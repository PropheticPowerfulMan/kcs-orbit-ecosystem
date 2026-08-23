from pydantic import BaseModel, ConfigDict, EmailStr, model_validator

from app.models.user import Role


class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: Role
    department: str
    access_code: str | None = None


class LoginRequest(BaseModel):
    email: str | None = None
    identifier: str | None = None
    password: str

    @model_validator(mode="after")
    def ensure_identifier(self):
        candidate = (self.identifier or self.email or "").strip()
        if not candidate:
            raise ValueError("identifier is required")
        self.identifier = candidate
        return self


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: EmailStr
    access_code: str | None = None
    role: Role
    department: str
