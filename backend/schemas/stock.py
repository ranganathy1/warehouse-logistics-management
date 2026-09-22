from pydantic import BaseModel

class StockResponse(BaseModel):
    item_id: int
    item_name: str
    uom_symbol: str
    available_quantity: float
    reserved_quantity: float
    total_on_hand: float
    reorder_level: float
    is_low_stock: bool
    
# class StockCreate(BaseModel):
    