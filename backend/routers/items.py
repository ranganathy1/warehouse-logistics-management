from fastapi import APIRouter ,HTTPException,Depends
from database import get_connection
from schemas.item import ItemResponse,ItemCreate
from auth import get_current_user,require_admin
import psycopg2
router = APIRouter(prefix="/items",tags = ["Items"])

@router.get("/",response_model=list[ItemResponse])

def get_items(current_user: dict = Depends(get_current_user) ):
    conn= get_connection()
    cursor = conn.cursor()
    try:
        
        cursor.execute("""
                    select i.item_id,i.item_name,i.description,i.reorder_level,u.uom_symbol,i.is_active
                    from items i
                    join unit_of_measure u on u.uom_id=i.uom_id
                    order by i.item_id asc
                    """)
        rows= cursor.fetchall()
        return [
            {
                "item_id":      row[0],
                "item_name":    row[1],
                "description":  row[2],
                "reorder_level": row[3],
                "uom_symbol":   row[4],
                "is_active":    row[5]
            }
            for row in rows
        ]
    except psycopg2.Error as e:
        raise HTTPException(status_code=400,detail=str(e))    
    finally:
        cursor.close()
        conn.close()
        
@router.post("/",response_model=ItemResponse)
def create_item(item: ItemCreate,current_user: dict= Depends(require_admin)):
    conn = get_connection()
    cursor= conn.cursor()
    try:
        cursor.execute("select uom_symbol from unit_of_measure where uom_id = %s", (item.uom_id,))
        uom = cursor.fetchone()
        if not uom:
            raise HTTPException(status_code=400,detail=f"UOM {item.uom_id} does not exist ")
        
        cursor.execute("""
            INSERT INTO items (item_name, description, reorder_level, uom_id)
            VALUES (%s, %s, %s, %s)
            RETURNING item_id, item_name, description, reorder_level, is_active
        """, (item.item_name, item.description, item.reorder_level, item.uom_id))
        
        new_item = cursor.fetchone()
        conn.commit()
        return {
            "item_id":      new_item[0],
            "item_name":    new_item[1],
            "description":  new_item[2],
            "reorder_level": new_item[3],
            "uom_symbol":   uom[0],
            "is_active":    new_item[4]
        }
        
    except psycopg2.Error as e:
        conn.rollback()
        raise HTTPException(status_code=400,detail=str(e))
    finally:
        cursor.close()
        conn.close()
        