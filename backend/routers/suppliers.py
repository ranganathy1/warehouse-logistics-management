from fastapi import APIRouter, HTTPException,Depends
from database import get_connection
from schemas.supplier import SupplierResponse, SupplierCreate,SupplierUpdate
from auth import get_current_user,require_admin,require_warehouse
import psycopg2

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])

@router.get("/", response_model=list[SupplierResponse])
def get_suppliers(current_user: dict = Depends(require_warehouse)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT supplier_id, supplier_name, email, phone, address, is_active
            FROM suppliers
            order by supplier_id asc
        """)
        rows = cursor.fetchall()
        return [
            {
                "supplier_id":   row[0],
                "supplier_name": row[1],
                "email":         row[2],
                "phone":         row[3],
                "address":       row[4],
                "is_active":     row[5]
            }
            for row in rows
        ]
    except psycopg2.Error as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()



 
@router.post("/", response_model=SupplierResponse)
def create_supplier(supplier: SupplierCreate,current_user: dict = Depends(require_admin)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO suppliers (supplier_name, email, phone, address)
            VALUES (%s, %s, %s, %s)
            RETURNING supplier_id, supplier_name, email, phone, address, is_active
        """, (supplier.supplier_name, supplier.email, supplier.phone, supplier.address))
        new_supplier = cursor.fetchone()
        conn.commit()
        return {
            "supplier_id":   new_supplier[0],
            "supplier_name": new_supplier[1],
            "email":         new_supplier[2],
            "phone":         new_supplier[3],
            "address":       new_supplier[4],
            "is_active":     new_supplier[5]
        }
    except psycopg2.Error as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()
        
@router.put("/{supplier_id}", response_model=SupplierResponse)
def update_supplier(supplier_id: int, supplier: SupplierUpdate, current_user: dict = Depends(require_admin)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE suppliers
            SET supplier_name = %s, email = %s, phone = %s, address = %s
            WHERE supplier_id = %s
            RETURNING supplier_id, supplier_name, email, phone, address, is_active
        """, (supplier.supplier_name, supplier.email, supplier.phone, supplier.address, supplier_id))
        updated = cursor.fetchone()
        if not updated:
            raise HTTPException(status_code=404, detail=f"Supplier {supplier_id} not found")
        conn.commit()
        return {
            "supplier_id":   updated[0],
            "supplier_name": updated[1],
            "email":         updated[2],
            "phone":         updated[3],
            "address":       updated[4],
            "is_active":     updated[5]
        }
    except psycopg2.Error as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()