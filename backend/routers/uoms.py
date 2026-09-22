from fastapi import APIRouter, HTTPException
from database import get_connection
import psycopg2

router = APIRouter(prefix="/uoms", tags=["UOMs"])

@router.get("/")
def get_uoms():
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT uom_id, uom_name, uom_symbol FROM unit_of_measure")
        rows = cursor.fetchall()
        return [
            {"uom_id": row[0], "uom_name": row[1], "uom_symbol": row[2]}
            for row in rows
        ]
    except psycopg2.Error as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()