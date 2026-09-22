import { useEffect, useState } from "react"
import { Table, Tag, Button, Modal, Form, Input, InputNumber, Select, message } from "antd"
import AppLayout from "../components/Layout"
import api from "../api/axios"

function Items() {
  const [items, setItems] = useState([])
  const [uoms, setUoms] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const user = JSON.parse(localStorage.getItem("user"))
  const isAdmin = user?.role === "Administrator"

  const fetchItems = () => {
    api.get("/items/")
      .then(res => { setItems(res.data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchItems()
    // Fetch UOMs for the dropdown
    api.get("/uoms").then(res => setUoms(res.data)).catch(() => {})
  }, [])

  const handleCreate = async (values) => {
    try {
      await api.post("/items/", values)
      message.success("Item created successfully")
      setModalOpen(false)
      form.resetFields()
      fetchItems()
    } catch (err) {
      message.error(err.response?.data?.detail || "Failed to create item")
    }
  }

  const columns = [
    { title: "ID",            dataIndex: "item_id",       key: "item_id" },
    { title: "Item Name",     dataIndex: "item_name",     key: "item_name" },
    { title: "Description",   dataIndex: "description",   key: "description" },
    { title: "Reorder Level", dataIndex: "reorder_level", key: "reorder_level" },
    { title: "UOM",           dataIndex: "uom_symbol",    key: "uom_symbol" },
    {
      title: "Status",
      dataIndex: "is_active",
      key: "is_active",
      render: (is_active) => (
        <Tag color={is_active ? "green" : "red"}>
          {is_active ? "Active" : "Inactive"}
        </Tag>
      )
    },
  ]

  return (
    <AppLayout>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
        <h2>Items</h2>
        {isAdmin && (
          <Button type="primary" onClick={() => setModalOpen(true)}>+ Create Item</Button>
        )}
      </div>

      <Table dataSource={items} columns={columns} rowKey="item_id" loading={loading} />

      <Modal
        title="Create Item"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="item_name" label="Item Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea />
          </Form.Item>
          <Form.Item name="reorder_level" label="Reorder Level" initialValue={0}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="uom_id" label="Unit of Measure" rules={[{ required: true }]}>
            <Select>
              {uoms.map(u => (
                <Select.Option key={u.uom_id} value={u.uom_id}>
                  {u.uom_name} ({u.uom_symbol})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}

export default Items