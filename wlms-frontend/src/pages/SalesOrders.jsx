import { useEffect, useState } from "react"
import { Table, Tag, Button, Modal, Form, Select, InputNumber, message, Descriptions, Divider, Popconfirm } from "antd"
import AppLayout from "../components/Layout"
import api from "../api/axios"

function SalesOrders() {
  const [orders, setOrders] = useState([])
  const [customers, setCustomers] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const [createModal, setCreateModal] = useState(false)
  const [lineModal, setLineModal] = useState(false)
  const [detailModal, setDetailModal] = useState(false)

  const [activeSOId, setActiveSOId] = useState(null)
  const [soDetail, setSODetail] = useState(null)

  const [createForm] = Form.useForm()
  const [lineForm] = Form.useForm()

  const user = JSON.parse(localStorage.getItem("user"))

  const fetchOrders = () => {
    api.get("/sales-orders")
      .then(res => { setOrders(res.data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchOrders()
    api.get("/customers").then(res => setCustomers(res.data))
    api.get("/items").then(res => setItems(res.data))
  }, [])

  const handleCreateSO = async (values) => {
    try {
      const res = await api.post("/sales-orders", {
        customer_id: values.customer_id,
        created_by:  user.user_id
      })
      message.success(`SO #${res.data.so_id} created! Now add lines.`)
      setCreateModal(false)
      createForm.resetFields()
      setActiveSOId(res.data.so_id)
      setLineModal(true)
      fetchOrders()
    } catch (err) {
      message.error(err.response?.data?.detail || "Failed to create SO")
    }
  }

  const handleAddLine = async (values) => {
    try {
      await api.post("/sales-orders/lines", {
        so_id:      activeSOId,
        item_id:    values.item_id,
        quantity:   values.quantity,
        unit_price: values.unit_price
      })
      message.success("Line added and stock reserved!")
      lineForm.resetFields()
    } catch (err) {
      message.error(err.response?.data?.detail || "Failed to add line")
    }
  }

  const handleAdvance = async (so_id) => {
    try {
      await api.post("/sales-orders/advance", { so_id })
      message.success("SO status advanced!")
      fetchOrders()
    } catch (err) {
      message.error(err.response?.data?.detail || "Failed to advance SO")
    }
  }

  const handleCancel = async (so_id) => {
    try {
      await api.post("/sales-orders/cancel", { so_id })
      message.success("SO cancelled. Stock released.")
      fetchOrders()
    } catch (err) {
      message.error(err.response?.data?.detail || "Failed to cancel SO")
    }
  }

  const handleViewDetail = async (so_id) => {
    try {
      // Fetch header and lines separately
      const headerRes = await api.get(`/sales-orders/${so_id}`)
      setSODetail(headerRes.data)
      setDetailModal(true)
    } catch (err) {
      message.error("Failed to load SO details")
    }
  }

  const statusColors = {
    Pending:    "orange",
    Processing: "blue",
    Packed:     "purple",
    Shipped:    "cyan",
    Delivered:  "green",
    Cancelled:  "red"
  }

  const paymentColors = {
    Unpaid:  "red",
    Paid:    "green",
    Partial: "orange"
  }

  const lineColumns = [
    { title: "Item",            dataIndex: "item_name",        key: "item_name" },
    { title: "UOM",             dataIndex: "uom_symbol",       key: "uom_symbol" },
    { title: "Ordered Qty",     dataIndex: "ordered_quantity", key: "ordered_quantity" },
    { title: "Shipped Qty",     dataIndex: "shipped_quantity", key: "shipped_quantity" },
    { title: "Pending Qty",     dataIndex: "pending_quantity", key: "pending_quantity" },
    { title: "Unit Price",      dataIndex: "unit_price",       key: "unit_price" },
    { title: "Line Total",      dataIndex: "line_total",       key: "line_total" },
  ]

  const columns = [
    { title: "SO ID",      dataIndex: "so_id",          key: "so_id" },
    { title: "Customer",   dataIndex: "customer_name",  key: "customer_name" },
    { title: "Created By", dataIndex: "created_by",     key: "created_by" },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => <Tag color={statusColors[status]}>{status}</Tag>
    },
    {
      title: "Payment",
      dataIndex: "payment_status",
      key: "payment_status",
      render: (payment_status) => <Tag color={paymentColors[payment_status]}>{payment_status}</Tag>
    },
    { title: "Created At", dataIndex: "created_at",     key: "created_at" },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <div style={{ display: "flex", gap: "8px" }}>
          <Button size="small" onClick={() => handleViewDetail(record.so_id)}>
            View
          </Button>
          {record.status === "Pending" && (
            <Button
              size="small"
              type="dashed"
              onClick={() => { setActiveSOId(record.so_id); setLineModal(true) }}
            >
              + Add Lines
            </Button>
          )}
          {["Pending", "Processing"].includes(record.status) && (
            <Popconfirm
              title={`Advance SO to ${record.status === "Pending" ? "Processing" : "Packed"}?`}
              onConfirm={() => handleAdvance(record.so_id)}
              okText="Yes"
              cancelText="No"
            >
              <Button size="small" type="primary">Advance</Button>
            </Popconfirm>
          )}
          {!["Shipped", "Delivered", "Cancelled"].includes(record.status) && (
            <Popconfirm
              title="Cancel this SO? Reserved stock will be released."
              onConfirm={() => handleCancel(record.so_id)}
              okText="Yes"
              cancelText="No"
            >
              <Button danger size="small">Cancel</Button>
            </Popconfirm>
          )}
        </div>
      )
    }
  ]

  return (
    <AppLayout>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
        <h2>Sales Orders</h2>
        <Button type="primary" onClick={() => setCreateModal(true)}>+ Create SO</Button>
      </div>

      <Table dataSource={orders} columns={columns} rowKey="so_id" loading={loading} />

      {/* Create SO Modal */}
      <Modal
        title="Create Sales Order"
        open={createModal}
        onCancel={() => { setCreateModal(false); createForm.resetFields() }}
        onOk={() => createForm.submit()}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateSO}>
          <Form.Item name="customer_id" label="Customer" rules={[{ required: true }]}>
            <Select placeholder="Select customer">
              {customers.map(c => (
                <Select.Option key={c.customer_id} value={c.customer_id}>
                  {c.customer_name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Lines Modal */}
      <Modal
        title={`Add Lines to SO #${activeSOId}`}
        open={lineModal}
        onCancel={() => { setLineModal(false); lineForm.resetFields(); fetchOrders() }}
        onOk={() => { setLineModal(false); lineForm.resetFields(); fetchOrders() }}
        okText="Done"
        cancelText="Close"
      >
        <Form form={lineForm} layout="vertical" onFinish={handleAddLine}>
          <Form.Item name="item_id" label="Item" rules={[{ required: true }]}>
            <Select placeholder="Select item">
              {items.filter(i => i.is_active).map(i => (
                <Select.Option key={i.item_id} value={i.item_id}>
                  {i.item_name} ({i.uom_symbol})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="quantity" label="Quantity" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="unit_price" label="Unit Price" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Button type="primary" onClick={() => lineForm.submit()} block>
            Add Line
          </Button>
        </Form>
        <Divider />
        <p style={{ color: "#888" }}>Keep adding lines. Click Done when finished.</p>
      </Modal>

      {/* Detail Modal */}
      <Modal
        title={`SO #${soDetail?.so_id} Details`}
        open={detailModal}
        onCancel={() => setDetailModal(false)}
        footer={null}
        width={800}
      >
        {soDetail && (
          <>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Customer">{soDetail.customer_name}</Descriptions.Item>
              <Descriptions.Item label="Created By">{soDetail.created_by}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={statusColors[soDetail.status]}>{soDetail.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Payment">
                <Tag color={paymentColors[soDetail.payment_status]}>{soDetail.payment_status}</Tag>
              </Descriptions.Item>
            </Descriptions>
            <Divider>Lines</Divider>
            <Table
              dataSource={soDetail.lines}
              columns={lineColumns}
              rowKey="item_name"
              pagination={false}
              size="small"
            />
          </>
        )}
      </Modal>
    </AppLayout>
  )
}

export default SalesOrders