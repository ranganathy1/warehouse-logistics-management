from pydantic import BaseModel

class SalesOrderCreate(BaseModel):
    customer_id: int 
    
class SOLineCreate(BaseModel):
    so_id: int
    item_id: int
    quantity: float
    unit_price: float
    
class SOAdvance(BaseModel):
    so_id: int
    
class SOCancel(BaseModel):
    so_id: int 
