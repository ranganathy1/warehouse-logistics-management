from fastapi import APIRouter , HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from fastapi import Depends
from database import get_connection
from auth import verify_password,create_token,get_current_user
import psycopg2

router = APIRouter(prefix="/auth",tags=["Auth"])

@router.post("/login")
def login(form:OAuth2PasswordRequestForm = Depends()):
    conn = get_connection()
    cursor=conn.cursor()
    try:
        cursor.execute("""
                       select u.user_id,u.username,u.password_hash,r.role_name
                       from users u
                       join user_roles ur on ur.user_id = u.user_id
                       join roles r on r.role_id = ur.role_id
                       where u.username = %s and u.is_active = true
                       """,(form.username,))
        
        user = cursor.fetchone()
        
        if not user : 
            raise HTTPException(status_code=401,detail="Invalide Username or Password ")
        
        user_id, username,password_hash , role = user
        
        if not verify_password(form.password,password_hash):
            raise HTTPException(status_code=401,detail="Invalid username or password")
        
        token = create_token({
            "user_id": user_id,
            "username": username,
            "role": role
        })
        
        return {"access_token": token , "token_type":"bearer"}
    
    except psycopg2.Error as e:
        raise HTTPException(status_code=400,detail=str(e))
    finally: 
        cursor.close()
        conn.close()
        

@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    
    return current_user