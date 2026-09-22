from fastapi import APIRouter, HTTPException,Depends
from database import get_connection
from schemas.stock import StockResponse
from auth import get_current_user
import psycopg2

router = APIRouter(prefix="/stock", tags=["Stock"])

@router.get("/", response_model=list[StockResponse])
def get_stock(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT item_id, item_name, uom_symbol,
                   available_quantity, reserved_quantity,
                   total_on_hand, reorder_level, is_low_stock
            FROM vw_stock_status
            order by item_id asc
        """)
        rows = cursor.fetchall()
        return [
            {
                "item_id":            row[0],
                "item_name":          row[1],
                "uom_symbol":         row[2],
                "available_quantity": row[3],
                "reserved_quantity":  row[4],
                "total_on_hand":      row[5],
                "reorder_level":      row[6],
                "is_low_stock":       row[7]
            }
            for row in rows
        ]
    except psycopg2.Error as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()