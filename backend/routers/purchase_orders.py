from fastapi import APIRouter, HTTPException,Depends
from database import get_connection
from schemas.purchase_order import PurchaseOrderCreate, POLineCreate, PurchaseOrderResponse,PurchaseOrderCancel
from auth import require_warehouse
import psycopg2

router = APIRouter(prefix="/purchase-orders", tags=["Purchase Orders"])

@router.get("/")
def get_purchase_orders(current_user: dict = Depends(require_warehouse)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT po.po_id, s.supplier_name, u.username, po.status, po.created_at
            FROM purchase_orders po
            JOIN suppliers s ON s.supplier_id = po.supplier_id
            JOIN users u ON u.user_id = po.created_by
            ORDER BY po.po_id DESC
        """)
        rows = cursor.fetchall()
        return [
            {
                "po_id":         row[0],
                "supplier_name": row[1],
                "created_by":    row[2],
                "status":        row[3],
                "created_at":    str(row[4])
            }
            for row in rows
        ]
    except psycopg2.Error as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.get("/{po_id}")
def get_purchase_order(po_id: int, current_user: dict = Depends(require_warehouse)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Get PO header separately
        cursor.execute("""
            SELECT po.po_id, s.supplier_name, u.username, po.status
            FROM purchase_orders po
            JOIN suppliers s ON s.supplier_id = po.supplier_id
            JOIN users u ON u.user_id = po.created_by
            WHERE po.po_id = %s
        """, (po_id,))
        header = cursor.fetchone()
        if not header:
            raise HTTPException(status_code=404, detail=f"PO {po_id} not found")

        # Get lines separately — returns empty list if no lines yet
        cursor.execute("""
            SELECT i.item_name, pol.ordered_quantity, pol.received_quantity,
                   pol.pending_quantity, pol.unit_cost, pol.line_total, u.uom_symbol
            FROM purchase_order_lines pol
            JOIN items i ON i.item_id = pol.item_id
            JOIN unit_of_measure u ON u.uom_id = i.uom_id
            WHERE pol.po_id = %s
        """, (po_id,))
        lines = cursor.fetchall()

        return {
            "po_id":         header[0],
            "supplier_name": header[1],
            "created_by":    header[2],
            "status":        header[3],
            "lines": [
                {
                    "item_name":         row[0],
                    "ordered_quantity":  row[1],
                    "received_quantity": row[2],
                    "pending_quantity":  row[3],
                    "unit_cost":         row[4],
                    "line_total":        row[5],
                    "uom_symbol":        row[6]
                }
                for row in lines
            ]
        }
    except psycopg2.Error as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.post("/", response_model=PurchaseOrderResponse)
def create_purchase_order(po: PurchaseOrderCreate,current_user: dict = Depends(require_warehouse)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("CALL sp_create_purchase_order(%s, %s)",
                       (po.supplier_id, current_user["user_id"]))
        cursor.execute("""
            SELECT po_id, supplier_id, created_by, status
            FROM purchase_orders
            ORDER BY po_id DESC
            LIMIT 1
        """)
        new_po = cursor.fetchone()
        conn.commit()
        return {
            "po_id":       new_po[0],
            "supplier_id": new_po[1],
            "created_by":  new_po[2],
            "status":      new_po[3]
        }
    except psycopg2.Error as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.post("/lines")
def add_po_line(line: POLineCreate, current_user: dict = Depends(require_warehouse)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("CALL sp_add_po_line(%s, %s, %s, %s)",
                       (line.po_id, line.item_id, line.quantity, line.unit_cost))
        conn.commit()
        return {"message": "Line added successfully"}
    except psycopg2.Error as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()
        
        
@router.post("/cancel")
def cancel_purchase_order(data: PurchaseOrderCancel, current_user: dict = Depends(require_warehouse)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("CALL sp_cancel_purchase_order(%s)", (data.po_id,))
        conn.commit()
        return {"message": f"PO {data.po_id} cancelled successfully"}
    except psycopg2.Error as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()