import { useEffect, useState } from "react"
import { Alert, Card, Col, Row, Space, Statistic, Tag, Typography } from "antd"
import { ArrowUpOutlined, WarningOutlined } from "@ant-design/icons"
import AppLayout from "../components/Layout"
import api from "../api/axios"

const { Text } = Typography

function Dashboard() {
  const user = JSON.parse(localStorage.getItem("user"))
  const [summary, setSummary] = useState({ items: 0, stock: 0, lowStock: 0 })
  const [error, setError] = useState("")

  useEffect(() => {
    Promise.all([api.get("/items"), api.get("/stock")])
      .then(([itemsResponse, stockResponse]) => {
        const stock = stockResponse.data || []
        setSummary({
          items: itemsResponse.data?.length || 0,
          stock: stock.reduce((total, row) => total + Number(row.total_on_hand || 0), 0),
          lowStock: stock.filter(row => row.is_low_stock).length
        })
      })
      .catch(() => setError("We could not load the latest warehouse summary."))
  }, [])

  return (
    <AppLayout>
      <Space direction="vertical" size={24} style={{ width: "100%" }}>
        <section className="dashboard-intro">
          <Tag color="lime" style={{ color: "#124838", border: 0 }}>OPERATIONS OVERVIEW</Tag>
          <h1>Good to see you, {user?.username}.</h1>
          <p>Keep procurement, stock, and fulfillment moving with a single view of today&apos;s warehouse activity.</p>
        </section>

        {error && <Alert type="warning" showIcon message={error} />}

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={8}>
            <Card className="metric-card"><Statistic title="Active items" value={summary.items} prefix={<ArrowUpOutlined />} /></Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card className="metric-card"><Statistic title="Units on hand" value={summary.stock} /></Card>
          </Col>
          <Col xs={24} sm={24} lg={8}>
            <Card className="metric-card alert"><Statistic title="Low-stock alerts" value={summary.lowStock} prefix={<WarningOutlined />} /></Card>
          </Col>
        </Row>

        <Card className="surface" title="Workspace status">
          <Space direction="vertical" size={8}>
            <Text type="secondary">Signed in as</Text>
            <Text strong>{user?.username} · {user?.role}</Text>
            <Text type="secondary">Use the navigation to manage master data, procurement, stock, and delivery workflows.</Text>
          </Space>
        </Card>
      </Space>
    </AppLayout>
  )
}

export default Dashboard
