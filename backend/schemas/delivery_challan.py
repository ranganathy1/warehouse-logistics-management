from pydantic import BaseModel

class DeliveryChallanCreate(BaseModel):
    so_id : int 
    driver_name: str |None = None
    vehicle_number: str | None = None
    
class DCLineCreate(BaseModel):
    dc_id: int
    item_id : int 
    quantity: float
    
class DCAction(BaseModel):
    dc_id: int
    