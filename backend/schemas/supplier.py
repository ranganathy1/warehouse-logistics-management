from pydantic import BaseModel

class SupplierResponse(BaseModel):
    supplier_id: int
    supplier_name: str
    email: str | None
    phone: str | None
    address: str | None
    is_active: bool
    
    
class SupplierCreate(BaseModel):
    supplier_name: str
    email: str | None =None
    phone: str | None=None
    address: str | None=None
    
    
class SupplierUpdate(BaseModel):
    supplier_name: str
    email: str | None = None
    phone: str | None = None
    address: str | None = None