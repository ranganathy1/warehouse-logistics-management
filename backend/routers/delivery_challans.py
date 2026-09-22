from fastapi import APIRouter, HTTPException,Depends
from database import get_connection
from schemas.delivery_challan import DeliveryChallanCreate, DCLineCreate, DCAction
from auth import require_logistics
import psycopg2

router = APIRouter(prefix="/delivery-challans", tags=["Delivery Challans"])

@router.get("/")
def get_delivery_challans(current_user: dict = Depends(require_logistics)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT dc.dc_id, dc.so_id, c.customer_name, u.username,
                   dc.driver_name, dc.vehicle_number, dc.status, dc.created_at
            FROM delivery_challans dc
            JOIN sales_orders so ON so.so_id = dc.so_id
            JOIN customers c ON c.customer_id = so.customer_id
            JOIN users u ON u.user_id = dc.created_by
            ORDER BY dc.dc_id DESC
        """)
        rows = cursor.fetchall()
        return [
            {
                "dc_id":          row[0],
                "so_id":          row[1],
                "customer_name":  row[2],
                "created_by":     row[3],
                "driver_name":    row[4],
                "vehicle_number": row[5],
                "status":         row[6],
                "created_at":     str(row[7])
            }
            for row in rows
        ]
    except psycopg2.Error as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.get("/{dc_id}")
def get_delivery_challan(dc_id: int, current_user: dict = Depends(require_logistics)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Header separately
        cursor.execute("""
            SELECT dc.dc_id, dc.so_id, c.customer_name, u.username,
                   dc.status, dc.driver_name, dc.vehicle_number,
                   dc.dispatched_at, dc.delivered_at
            FROM delivery_challans dc
            JOIN sales_orders so ON so.so_id = dc.so_id
            JOIN customers c ON c.customer_id = so.customer_id
            JOIN users u ON u.user_id = dc.created_by
            WHERE dc.dc_id = %s
        """, (dc_id,))
        header = cursor.fetchone()
        if not header:
            raise HTTPException(status_code=404, detail=f"DC {dc_id} not found")

        # Lines separately
        cursor.execute("""
            SELECT i.item_name, dcl.shipped_quantity, u.uom_symbol
            FROM delivery_challan_lines dcl
            JOIN items i ON i.item_id = dcl.item_id
            JOIN unit_of_measure u ON u.uom_id = i.uom_id
            WHERE dcl.dc_id = %s
            ORDER BY dcl.dc_line_id ASC
        """, (dc_id,))
        lines = cursor.fetchall()

        return {
            "dc_id":          header[0],
            "so_id":          header[1],
            "customer_name":  header[2],
            "created_by":     header[3],
            "status":         header[4],
            "driver_name":    header[5],
            "vehicle_number": header[6],
            "dispatched_at":  str(header[7]) if header[7] else None,
            "delivered_at":   str(header[8]) if header[8] else None,
            "lines": [
                {
                    "item_name":        row[0],
                    "shipped_quantity": row[1],
                    "uom_symbol":       row[2]
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
def create_delivery_challan(dc: DeliveryChallanCreate, current_user: dict = Depends(require_logistics)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("CALL sp_create_dc(%s, %s, %s, %s)",
                       (dc.so_id, current_user["user_id"], dc.driver_name, dc.vehicle_number))
        cursor.execute("""
            SELECT dc_id, so_id, created_by, driver_name, vehicle_number, status
            FROM delivery_challans
            ORDER BY dc_id DESC
            LIMIT 1
        """)
        new_dc = cursor.fetchone()
        conn.commit()
        return {
            "dc_id":          new_dc[0],
            "so_id":          new_dc[1],
            "created_by":     new_dc[2],
            "driver_name":    new_dc[3],
            "vehicle_number": new_dc[4],
            "status":         new_dc[5]
        }
    except psycopg2.Error as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.post("/lines")
def add_dc_line(line: DCLineCreate,current_user: dict = Depends(require_logistics)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("CALL sp_add_dc_line(%s, %s, %s)",
                       (line.dc_id, line.item_id, line.quantity))
        conn.commit()
        return {"message": "DC line added successfully"}
    except psycopg2.Error as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.post("/dispatch")
def dispatch_dc(data: DCAction,current_user: dict = Depends(require_logistics)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("CALL sp_dispatch_dc(%s)", (data.dc_id,))
        conn.commit()
        return {"message": f"DC {data.dc_id} dispatched. Stock updated."}
    except psycopg2.Error as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.post("/deliver")
def deliver_dc(data: DCAction,current_user: dict = Depends(require_logistics)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("CALL sp_deliver_dc(%s)", (data.dc_id,))
        conn.commit()
        return {"message": f"DC {data.dc_id} delivered. SO updated."}
    except psycopg2.Error as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()