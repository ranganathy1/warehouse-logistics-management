from fastapi import APIRouter, HTTPException, Depends
from database import get_connection
from schemas.users import UserCreate, UserUpdate, UserResponse
from auth import require_admin, hash_password
import psycopg2

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/", response_model=list[UserResponse])
def get_users(current_user: dict = Depends(require_admin)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT u.user_id, u.username, r.role_name, u.is_active
            FROM users u
            JOIN user_roles ur ON ur.user_id = u.user_id
            JOIN roles r ON r.role_id = ur.role_id
            ORDER BY u.user_id
        """)
        rows = cursor.fetchall()
        return [
            {
                "user_id":   row[0],
                "username":  row[1],
                "role_name": row[2],
                "is_active": row[3]
            }
            for row in rows
        ]
    except psycopg2.Error as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@router.post("/", response_model=UserResponse)
def create_user(user: UserCreate, current_user: dict = Depends(require_admin)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Check role exists
        cursor.execute("SELECT role_id FROM roles WHERE role_name = %s", (user.role_name,))
        role = cursor.fetchone()
        if not role:
            raise HTTPException(status_code=400, detail=f"Role '{user.role_name}' does not exist")

        # Create the user with hashed password
        cursor.execute("""
            INSERT INTO users (username, password_hash)
            VALUES (%s, %s)
            RETURNING user_id, username, is_active
        """, (user.username, hash_password(user.password)))

        new_user = cursor.fetchone()
        user_id = new_user[0]

        # Assign role
        cursor.execute("""
            INSERT INTO user_roles (user_id, role_id)
            VALUES (%s, %s)
        """, (user_id, role[0]))

        conn.commit()
        return {
            "user_id":   user_id,
            "username":  new_user[1],
            "role_name": user.role_name,
            "is_active": new_user[2]
        }
    except psycopg2.Error as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@router.put("/{user_id}", response_model=UserResponse)
def update_user(user_id: int, user: UserUpdate, current_user: dict = Depends(require_admin)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Check user exists
        cursor.execute("SELECT user_id FROM users WHERE user_id = %s", (user_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail=f"User {user_id} not found")

        # Update is_active if provided
        if user.is_active is not None:
            cursor.execute("""
                UPDATE users SET is_active = %s WHERE user_id = %s
            """, (user.is_active, user_id))

        # Update role if provided
        if user.role_name is not None:
            cursor.execute("SELECT role_id FROM roles WHERE role_name = %s", (user.role_name,))
            role = cursor.fetchone()
            if not role:
                raise HTTPException(status_code=400, detail=f"Role '{user.role_name}' does not exist")

            # Delete old role and assign new one
            cursor.execute("DELETE FROM user_roles WHERE user_id = %s", (user_id,))
            cursor.execute("""
                INSERT INTO user_roles (user_id, role_id)
                VALUES (%s, %s)
            """, (user_id, role[0]))

        conn.commit()

        # Return updated user
        cursor.execute("""
            SELECT u.user_id, u.username, r.role_name, u.is_active
            FROM users u
            JOIN user_roles ur ON ur.user_id = u.user_id
            JOIN roles r ON r.role_id = ur.role_id
            WHERE u.user_id = %s
        """, (user_id,))
        updated = cursor.fetchone()
        return {
            "user_id":   updated[0],
            "username":  updated[1],
            "role_name": updated[2],
            "is_active": updated[3]
        }
    except psycopg2.Error as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@router.delete("/{user_id}")
def deactivate_user(user_id: int, current_user: dict = Depends(require_admin)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        if user_id == current_user["user_id"]:
            raise HTTPException(status_code=400, detail="You cannot deactivate your own account")

        cursor.execute("SELECT user_id FROM users WHERE user_id = %s", (user_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail=f"User {user_id} not found")

        cursor.execute("""
            UPDATE users SET is_active = FALSE WHERE user_id = %s
        """, (user_id,))

        conn.commit()
        return {"message": f"User {user_id} deactivated successfully"}
    except psycopg2.Error as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()