from fastapi import APIRouter, HTTPException,Depends
from database import get_connection
from schemas.grn import GRNCreate, GRNLineCreate, GRNConfirm
from auth import require_warehouse
import psycopg2

router = APIRouter(prefix="/grns", tags=["Goods Receipts"])

@router.get("/")
def get_grns(current_user: dict = Depends(require_warehouse)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT gr.grn_id, gr.po_id, u.username, gr.status, gr.received_at
            FROM goods_receipts gr
            JOIN users u ON u.user_id = gr.received_by
            ORDER BY gr.grn_id DESC
        """)
        rows = cursor.fetchall()
        return [
            {
                "grn_id":      row[0],
                "po_id":       row[1],
                "received_by": row[2],
                "status":      row[3],
                "received_at": str(row[4])
            }
            for row in rows
        ]
    except psycopg2.Error as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.get("/{grn_id}")
def get_grn(grn_id: int,current_user: dict = Depends(require_warehouse)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT grn_id, po_id, received_by, grn_status,
                   item_name, received_quantity, uom_symbol
            FROM vw_grn_full
            WHERE grn_id = %s
        """, (grn_id,))
        rows = cursor.fetchall()
        if not rows:
            raise HTTPException(status_code=404, detail=f"GRN {grn_id} not found")
        return {
            "grn_id":      rows[0][0],
            "po_id":       rows[0][1],
            "received_by": rows[0][2],
            "status":      rows[0][3],
            "lines": [
                {
                    "item_name":         row[4],
                    "received_quantity": row[5],
                    "uom_symbol":        row[6]
                }
                for row in rows
            ]
        }
    except psycopg2.Error as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.post("/")
def create_grn(grn: GRNCreate , current_user: dict = Depends(require_warehouse)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("CALL sp_create_grn(%s, %s)",
                       (grn.po_id, current_user["user_id"]))
        cursor.execute("""
            SELECT grn_id, po_id, received_by, status
            FROM goods_receipts
            ORDER BY grn_id DESC
            LIMIT 1
        """)
        new_grn = cursor.fetchone()
        conn.commit()
        return {
            "grn_id":      new_grn[0],
            "po_id":       new_grn[1],
            "received_by": new_grn[2],
            "status":      new_grn[3]
        }
    except psycopg2.Error as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.post("/lines")
def add_grn_line(line: GRNLineCreate, current_user: dict = Depends(require_warehouse)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("CALL sp_add_grn_line(%s, %s, %s)",
                       (line.grn_id, line.item_id, line.quantity))
        conn.commit()
        return {"message": "GRN line added successfully"}
    except psycopg2.Error as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.post("/confirm")
def confirm_grn(data: GRNConfirm , current_user: dict = Depends(require_warehouse)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("CALL sp_confirm_grn(%s)", (data.grn_id,))
        conn.commit()
        return {"message": f"GRN {data.grn_id} confirmed. Stock updated."}
    except psycopg2.Error as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()