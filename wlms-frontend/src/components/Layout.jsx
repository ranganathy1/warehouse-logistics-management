import { Layout, Menu, Tag } from "antd"
import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import {
  DashboardOutlined,
  ShoppingCartOutlined,
  InboxOutlined,
  TeamOutlined,
  UserOutlined,
  ShopOutlined,
  AppstoreOutlined,
  CarOutlined,
  LogoutOutlined,
  DatabaseOutlined
} from "@ant-design/icons"

const { Sider, Header, Content } = Layout

function AppLayout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const user = JSON.parse(localStorage.getItem("user"))
  const role = user?.role
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = () => {
    localStorage.clear()
    navigate("/login")
  }

  const allMenuItems = [
    {
      key: "/dashboard",
      icon: <DashboardOutlined />,
      label: "Dashboard",
      roles: ["Administrator", "Warehouse Staff", "Logistics Staff"]
    },
    {
      key: "/items",
      icon: <AppstoreOutlined />,
      label: "Items",
      roles: ["Administrator", "Warehouse Staff", "Logistics Staff"]
    },
    {
      key: "/stock",
      icon: <DatabaseOutlined />,
      label: "Stock",
      roles: ["Administrator", "Warehouse Staff", "Logistics Staff"]
    },
    {
      key: "/suppliers",
      icon: <ShopOutlined />,
      label: "Suppliers",
      roles: ["Administrator", "Warehouse Staff"]
    },
    {
      key: "/purchase-orders",
      icon: <ShoppingCartOutlined />,
      label: "Purchase Orders",
      roles: ["Administrator", "Warehouse Staff"]
    },
    {
      key: "/grns",
      icon: <InboxOutlined />,
      label: "Goods Receipts",
      roles: ["Administrator", "Warehouse Staff"]
    },
    {
      key: "/customers",
      icon: <TeamOutlined />,
      label: "Customers",
      roles: ["Administrator", "Logistics Staff"]
    },
    {
      key: "/sales-orders",
      icon: <ShoppingCartOutlined />,
      label: "Sales Orders",
      roles: ["Administrator", "Logistics Staff"]
    },
    {
      key: "/delivery-challans",
      icon: <CarOutlined />,
      label: "Delivery Challans",
      roles: ["Administrator", "Logistics Staff"]
    },
    {
      key: "/users",
      icon: <UserOutlined />,
      label: "Users",
      roles: ["Administrator"]
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Logout",
      roles: ["Administrator", "Warehouse Staff", "Logistics Staff"],
      danger: true
    }
  ]

  const menuItems = allMenuItems
    .filter(item => item.roles.includes(role))
    .map(({ roles, ...rest }) => rest)  // remove roles before passing to Menu

  const handleMenuClick = ({ key }) => {
    if (key === "logout") {
      handleLogout()
    } else {
      navigate(key)
    }
  }

  return (
    <Layout className="app-shell" style={{ minHeight: "100vh" }}>
      <Sider
        className="app-sider"
        theme="dark"
        width={232}
        collapsedWidth={0}
        breakpoint="lg"
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
      >
        <div className="brand-mark"><span>W</span> WLMS</div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ marginTop: "8px" }}
        />
      </Sider>

      <Layout>
        <Header className="app-header" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <span style={{ marginRight: "10px", color: "#6d7c75" }}>{user?.username}</span>
          <Tag color="green">{role}</Tag>
        </Header>

        <Content className="page-content">
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}

export default AppLayout