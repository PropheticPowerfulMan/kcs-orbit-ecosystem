from pydantic import BaseModel, EmailStr

from app.models.user import Role


class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: Role
    department: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: Role
    department: str

    class Config:
        from_attributes = True
