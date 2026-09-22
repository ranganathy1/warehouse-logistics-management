from fastapi import APIRouter, HTTPException ,Depends
from database import get_connection
from schemas.sales_orders import SalesOrderCreate, SOLineCreate, SOAdvance, SOCancel
from auth import require_logistics
import psycopg2

router = APIRouter(prefix="/sales-orders", tags=["Sales Orders"])

@router.get("/")
def get_sales_orders(current_user: dict = Depends(require_logistics)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT so.so_id, c.customer_name, u.username,
                   so.status, so.payment_status, so.created_at
            FROM sales_orders so
            JOIN customers c ON c.customer_id = so.customer_id
            JOIN users u ON u.user_id = so.created_by
            ORDER BY so.so_id DESC
        """)
        rows = cursor.fetchall()
        return [
            {
                "so_id":          row[0],
                "customer_name":  row[1],
                "created_by":     row[2],
                "status":         row[3],
                "payment_status": row[4],
                "created_at":     str(row[5])
            }
            for row in rows
        ]
    except psycopg2.Error as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.get("/{so_id}")
def get_sales_order(so_id: int, current_user: dict = Depends(require_logistics)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Header separately
        cursor.execute("""
            SELECT so.so_id, c.customer_name, u.username,
                   so.status, so.payment_status
            FROM sales_orders so
            JOIN customers c ON c.customer_id = so.customer_id
            JOIN users u ON u.user_id = so.created_by
            WHERE so.so_id = %s
        """, (so_id,))
        header = cursor.fetchone()
        if not header:
            raise HTTPException(status_code=404, detail=f"SO {so_id} not found")

        # Lines separately
        cursor.execute("""
            SELECT i.item_name, sol.ordered_quantity, sol.shipped_quantity,
                   sol.pending_quantity, sol.unit_price, sol.line_total, u.uom_symbol
            FROM sales_order_lines sol
            JOIN items i ON i.item_id = sol.item_id
            JOIN unit_of_measure u ON u.uom_id = i.uom_id
            WHERE sol.so_id = %s
            ORDER BY sol.so_line_id ASC
        """, (so_id,))
        lines = cursor.fetchall()

        return {
            "so_id":          header[0],
            "customer_name":  header[1],
            "created_by":     header[2],
            "status":         header[3],
            "payment_status": header[4],
            "lines": [
                {
                    "item_name":        row[0],
                    "ordered_quantity": row[1],
                    "shipped_quantity": row[2],
                    "pending_quantity": row[3],
                    "unit_price":       row[4],
                    "line_total":       row[5],
                    "uom_symbol":       row[6]
                }
                for row in lines
            ]
        }
    except psycopg2.Error as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()
        
@router.post("/")
def create_sales_order(so: SalesOrderCreate,current_user: dict = Depends(require_logistics)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("CALL sp_create_sales_order(%s, %s)",
                       (so.customer_id, current_user["user_id"]))
        cursor.execute("""
            SELECT so_id, customer_id, created_by, status, payment_status
            FROM sales_orders
            ORDER BY so_id DESC
            LIMIT 1
        """)
        new_so = cursor.fetchone()
        conn.commit()
        return {
            "so_id":          new_so[0],
            "customer_id":    new_so[1],
            "created_by":     new_so[2],
            "status":         new_so[3],
            "payment_status": new_so[4]
        }
    except psycopg2.Error as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.post("/lines")
def add_so_line(line: SOLineCreate,current_user: dict = Depends(require_logistics)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("CALL sp_add_so_line(%s, %s, %s, %s)",
                       (line.so_id, line.item_id, line.quantity, line.unit_price))
        conn.commit()
        return {"message": "Line added and stock reserved successfully"}
    except psycopg2.Error as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.post("/advance")
def advance_so(data: SOAdvance,current_user: dict = Depends(require_logistics)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("CALL sp_advance_so_status(%s)", (data.so_id,))
        conn.commit()
        return {"message": f"SO {data.so_id} status advanced successfully"}
    except psycopg2.Error as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.post("/cancel")
def cancel_so(data: SOCancel,current_user: dict = Depends(require_logistics)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("CALL sp_cancel_sales_order(%s)", (data.so_id,))
        conn.commit()
        return {"message": f"SO {data.so_id} cancelled. Reserved stock released."}
    except psycopg2.Error as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()