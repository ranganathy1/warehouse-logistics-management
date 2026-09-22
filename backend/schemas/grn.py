from pydantic import BaseModel

class GRNCreate(BaseModel):
    po_id: int 
    
class GRNLineCreate(BaseModel):
    grn_id: int 
    item_id: int 
    quantity: float
    
class GRNConfirm(BaseModel):
    grn_id : int