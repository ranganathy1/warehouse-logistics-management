from pydantic import BaseModel

class PurchaseOrderCreate(BaseModel):
    supplier_id: int
    
class POLineCreate(BaseModel):
    po_id: int
    item_id:int
    quantity: int
    unit_cost:int
    
class PurchaseOrderResponse(BaseModel):
    po_id: int
    supplier_id: int
    created_by: int
    status: str

class PurchaseOrderCancel(BaseModel):
    po_id: int