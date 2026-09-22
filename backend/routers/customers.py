from fastapi import APIRouter, HTTPException , Depends
from database import get_connection
from schemas.customer import CustomerResponse,CustomerCreate,CustomerUpdate
from auth import require_admin,require_logistics
import psycopg2

router = APIRouter(prefix="/customers", tags=["Customers"])

@router.get("/", response_model=list[CustomerResponse])
def get_customers(current_user: dict = Depends(require_logistics)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT customer_id, customer_name, phone, address
            FROM customers
            order by customer_id asc
        """)
        rows = cursor.fetchall()
        return [
            {
                "customer_id":   row[0],
                "customer_name": row[1],
                "phone":         row[2],
                "address":       row[3]
            }
            for row in rows
        ]
    except psycopg2.Error as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()
        
@router.post("/", response_model=CustomerResponse)
def create_customer(customer: CustomerCreate, current_user: dict = Depends(require_admin)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO customers (customer_name, phone, address)
            VALUES (%s, %s, %s)
            RETURNING customer_id, customer_name, phone, address
        """, (customer.customer_name, customer.phone, customer.address))
        new_customer = cursor.fetchone()
        conn.commit()
        return {
            "customer_id":   new_customer[0],
            "customer_name": new_customer[1],
            "phone":         new_customer[2],
            "address":       new_customer[3]
        }
    except psycopg2.Error as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()
        

@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(customer_id: int, customer: CustomerUpdate, current_user: dict = Depends(require_admin)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE customers
            SET customer_name = %s, phone = %s, address = %s
            WHERE customer_id = %s
            RETURNING customer_id, customer_name, phone, address
        """, (customer.customer_name, customer.phone, customer.address, customer_id))
        updated = cursor.fetchone()
        if not updated:
            raise HTTPException(status_code=404, detail=f"Customer {customer_id} not found")
        conn.commit()
        return {
            "customer_id":   updated[0],
            "customer_name": updated[1],
            "phone":         updated[2],
            "address":       updated[3]
        }
    except psycopg2.Error as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()