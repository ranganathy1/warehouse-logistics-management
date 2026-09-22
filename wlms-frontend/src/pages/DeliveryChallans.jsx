import { useEffect, useState } from "react"
import { Table, Tag, Button, Modal, Form, Select, InputNumber, Input, message, Descriptions, Divider, Popconfirm } from "antd"
import AppLayout from "../components/Layout"
import api from "../api/axios"

function DeliveryChallans() {
  const [challans, setChallans] = useState([])
  const [salesOrders, setSalesOrders] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const [createModal, setCreateModal] = useState(false)
  const [lineModal, setLineModal] = useState(false)
  const [detailModal, setDetailModal] = useState(false)

  const [activeDCId, setActiveDCId] = useState(null)
  const [dcDetail, setDCDetail] = useState(null)

  const [createForm] = Form.useForm()
  const [lineForm] = Form.useForm()

  const user = JSON.parse(localStorage.getItem("user"))

  const fetchChallans = () => {
    api.get("/delivery-challans")
      .then(res => { setChallans(res.data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchChallans()
    // Only Packed SOs can have a DC created
    api.get("/sales-orders").then(res =>
      setSalesOrders(res.data.filter(so => so.status === "Packed"))
    )
    api.get("/items").then(res => setItems(res.data))
  }, [])

  const handleCreateDC = async (values) => {
    try {
      const res = await api.post("/delivery-challans", {
        so_id:          values.so_id,
        created_by:     user.user_id,
        driver_name:    values.driver_name,
        vehicle_number: values.vehicle_number
      })
      message.success(`DC #${res.data.dc_id} created! Now add lines.`)
      setCreateModal(false)
      createForm.resetFields()
      setActiveDCId(res.data.dc_id)
      setLineModal(true)
      fetchChallans()
    } catch (err) {
      message.error(err.response?.data?.detail || "Failed to create DC")
    }
  }

  const handleAddLine = async (values) => {
    try {
      await api.post("/delivery-challans/lines", {
        dc_id:    activeDCId,
        item_id:  values.item_id,
        quantity: values.quantity
      })
      message.success("Line added successfully")
      lineForm.resetFields()
    } catch (err) {
      message.error(err.response?.data?.detail || "Failed to add line")
    }
  }

  const handleDispatch = async (dc_id) => {
    try {
      await api.post("/delivery-challans/dispatch", { dc_id })
      message.success("DC dispatched! Stock updated.")
      fetchChallans()
    } catch (err) {
      message.error(err.response?.data?.detail || "Failed to dispatch DC")
    }
  }

  const handleDeliver = async (dc_id) => {
    try {
      await api.post("/delivery-challans/deliver", { dc_id })
      message.success("DC delivered! SO updated.")
      fetchChallans()
    } catch (err) {
      message.error(err.response?.data?.detail || "Failed to deliver DC")
    }
  }

  const handleViewDetail = async (dc_id) => {
    try {
      const res = await api.get(`/delivery-challans/${dc_id}`)
      setDCDetail(res.data)
      setDetailModal(true)
    } catch (err) {
      message.error("Failed to load DC details")
    }
  }

  const statusColors = {
    Pending:    "orange",
    Dispatched: "blue",
    Delivered:  "green",
    Failed:     "red"
  }

  const lineColumns = [
    { title: "Item",         dataIndex: "item_name",        key: "item_name" },
    { title: "Shipped Qty",  dataIndex: "shipped_quantity", key: "shipped_quantity" },
    { title: "UOM",          dataIndex: "uom_symbol",       key: "uom_symbol" },
  ]

  const columns = [
    { title: "DC ID",      dataIndex: "dc_id",          key: "dc_id" },
    { title: "SO ID",      dataIndex: "so_id",          key: "so_id" },
    { title: "Customer",   dataIndex: "customer_name",  key: "customer_name" },
    { title: "Driver",     dataIndex: "driver_name",    key: "driver_name" },
    { title: "Vehicle",    dataIndex: "vehicle_number", key: "vehicle_number" },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => <Tag color={statusColors[status]}>{status}</Tag>
    },
    { title: "Created At", dataIndex: "created_at",     key: "created_at" },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <div style={{ display: "flex", gap: "8px" }}>
          <Button size="small" onClick={() => handleViewDetail(record.dc_id)}>
            View
          </Button>
          {record.status === "Pending" && (
            <>
              <Button
                size="small"
                type="dashed"
                onClick={() => { setActiveDCId(record.dc_id); setLineModal(true) }}
              >
                + Add Lines
              </Button>
              <Popconfirm
                title="Dispatch this DC? Reserved stock will be released."
                onConfirm={() => handleDispatch(record.dc_id)}
                okText="Yes"
                cancelText="No"
              >
                <Button size="small" type="primary">Dispatch</Button>
              </Popconfirm>
            </>
          )}
          {record.status === "Dispatched" && (
            <Popconfirm
              title="Mark this DC as Delivered?"
              onConfirm={() => handleDeliver(record.dc_id)}
              okText="Yes"
              cancelText="No"
            >
              <Button size="small" type="primary">Deliver</Button>
            </Popconfirm>
          )}
        </div>
      )
    }
  ]

  return (
    <AppLayout>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
        <h2>Delivery Challans</h2>
        <Button type="primary" onClick={() => setCreateModal(true)}>+ Create DC</Button>
      </div>

      <Table dataSource={challans} columns={columns} rowKey="dc_id" loading={loading} />

      {/* Create DC Modal */}
      <Modal
        title="Create Delivery Challan"
        open={createModal}
        onCancel={() => { setCreateModal(false); createForm.resetFields() }}
        onOk={() => createForm.submit()}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateDC}>
          <Form.Item name="so_id" label="Sales Order (Packed only)" rules={[{ required: true }]}>
            <Select placeholder="Select SO">
              {salesOrders.map(so => (
                <Select.Option key={so.so_id} value={so.so_id}>
                  SO #{so.so_id} — {so.customer_name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="driver_name" label="Driver Name">
            <Input />
          </Form.Item>
          <Form.Item name="vehicle_number" label="Vehicle Number">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Lines Modal */}
      <Modal
        title={`Add Lines to DC #${activeDCId}`}
        open={lineModal}
        onCancel={() => { setLineModal(false); lineForm.resetFields(); fetchChallans() }}
        onOk={() => { setLineModal(false); lineForm.resetFields(); fetchChallans() }}
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
          <Form.Item name="quantity" label="Quantity to Ship" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: "100%" }} />
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
        title={`DC #${dcDetail?.dc_id} Details`}
        open={detailModal}
        onCancel={() => setDetailModal(false)}
        footer={null}
        width={700}
      >
        {dcDetail && (
          <>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="SO ID">{dcDetail.so_id}</Descriptions.Item>
              <Descriptions.Item label="Customer">{dcDetail.customer_name}</Descriptions.Item>
              <Descriptions.Item label="Driver">{dcDetail.driver_name}</Descriptions.Item>
              <Descriptions.Item label="Vehicle">{dcDetail.vehicle_number}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={statusColors[dcDetail.status]}>{dcDetail.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Dispatched At">
                {dcDetail.dispatched_at || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Delivered At">
                {dcDetail.delivered_at || "—"}
              </Descriptions.Item>
            </Descriptions>
            <Divider>Lines</Divider>
            <Table
              dataSource={dcDetail.lines}
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

export default DeliveryChallans