from datetime import datetime,timedelta,timezone
from jose import JWTError,jwt
from passlib.context import CryptContext
from fastapi import Depends,HTTPException
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
import os

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "wlms-local-development-secret")
ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = 60 * 8

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

pwd_context = CryptContext(schemes=["bcrypt"],deprecated="auto")

def verify_password(plain_password: str,hashed_password: str) -> bool:
    return pwd_context.verify(plain_password,hashed_password)

def hash_password(password: str)-> str:
    return pwd_context.hash(password)

def create_token(data: dict) -> str:
    to_encode = data.copy()
    to_encode["exp"] = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token:str =Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token,SECRET_KEY,algorithms=[ALGORITHM])
        user_id: int = payload.get("user_id")
        username: str= payload.get("username")
        role: str = payload.get("role")
        
        if user_id is None:
            raise HTTPException(status_code=401,detail="Invalid Token")
        
        return{"user_id": user_id, "username": username ,"role": role}
    
    except JWTError:
        raise HTTPException(status_code=403,detail="Invalid or Expired Token")
    
    
def require_admin(current_user:dict = Depends(get_current_user)):
    if current_user["role"] != "Administrator":
        raise HTTPException(status_code=403,detail="Admin access required")
    return current_user

def require_warehouse(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ("Administrator", "Warehouse Staff"):
        raise HTTPException(status_code=403, detail="Warehouse access required")
    return current_user

def require_logistics(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ("Administrator", "Logistics Staff"):
        raise HTTPException(status_code=403, detail="Logistics access required")
    return current_user