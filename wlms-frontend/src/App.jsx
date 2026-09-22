import {BrowserRouter, Routes, Route,Navigate} from "react-router-dom"
import Login from "./pages/Login"
import Dashboard from "./pages/Dashboard"
import Items from "./pages/Items"
import Stock from "./pages/Stock"
import Suppliers from  "./pages/Suppliers"
import Customers from "./pages/Customers"
import PurchaseOrders from "./pages/PurchaseOrders"
import GRNs from "./pages/GRNs"
import SalesOrders from "./pages/SalesOrders"
import DeliveryChallans from "./pages/DeliveryChallans"
import Users from "./pages/Users"


function App() {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/items" element={<Items />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/purchase-orders" element={<PurchaseOrders />} />
          <Route path="/grns" element={<GRNs />} />
          <Route path="/sales-orders" element={<SalesOrders />} />
          <Route path="/delivery-challans" element={<DeliveryChallans />} />
          <Route path="/users" element={<Users />} />
        </Routes>
      </BrowserRouter>
    )
}

export default App