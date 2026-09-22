from pydantic import BaseModel

class UserCreate(BaseModel):
    username: str
    password: str
    role_name: str  # "Administrator", "Warehouse Staff", "Logistics Staff"

class UserUpdate(BaseModel):
    role_name: str | None = None
    is_active: bool | None = None

class UserResponse(BaseModel):
    user_id: int
    username: str
    role_name: str
    is_active: bool