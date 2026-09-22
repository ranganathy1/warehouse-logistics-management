from pydantic import BaseModel

class CustomerResponse(BaseModel):
    customer_id: int
    customer_name: str
    phone: str | None
    address: str | None
    
class CustomerCreate(BaseModel):
    customer_name: str
    phone: str | None = None
    address: str | None = None

class CustomerUpdate(BaseModel):
    customer_name: str
    phone: str | None = None
    address: str | None = None