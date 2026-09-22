from pydantic import BaseModel

class ItemResponse(BaseModel):
    item_id: int
    item_name: str
    description: str | None
    reorder_level: float
    uom_symbol : str
    is_active: bool
    
class ItemCreate(BaseModel):
    item_name: str
    description: str | None = None
    reorder_level: float = 0
    uom_id: int