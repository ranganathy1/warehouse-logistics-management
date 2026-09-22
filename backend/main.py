from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import get_connection
from routers import delivery_challans, items,suppliers,customers,stock,purchase_orders,grns,sales_orders,auth,user,uoms


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://192.168.0.103:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(user.router)
app.include_router(items.router)
app.include_router(suppliers.router)
app.include_router(customers.router)
app.include_router(stock.router)
app.include_router(purchase_orders.router)
app.include_router(grns.router)
app.include_router(sales_orders.router)
app.include_router(delivery_challans.router)
app.include_router(uoms.router)

@app.get("/")

def root():
    return {"message": "WLMS backend"}
