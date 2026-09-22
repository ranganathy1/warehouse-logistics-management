import { useEffect, useState } from "react"
import { Table, Tag, Button, Modal, Form, Input, message } from "antd"
import AppLayout from "../components/Layout"
import api from "../api/axios"

function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [createModal, setCreateModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState(null)
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const user = JSON.parse(localStorage.getItem("user"))
  const isAdmin = user?.role === "Administrator"

  const fetchSuppliers = () => {
    api.get("/suppliers")
      .then(res => { setSuppliers(res.data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchSuppliers() }, [])

  const handleCreate = async (values) => {
    try {
      await api.post("/suppliers", values)
      message.success("Supplier created successfully")
      setCreateModal(false)
      createForm.resetFields()
      fetchSuppliers()
    } catch (err) {
      message.error(err.response?.data?.detail || "Failed to create supplier")
    }
  }

  const handleEdit = (record) => {
    setSelectedSupplier(record)
    editForm.setFieldsValue({
      supplier_name: record.supplier_name,
      email:         record.email,
      phone:         record.phone,
      address:       record.address
    })
    setEditModal(true)
  }

  const handleUpdate = async (values) => {
    try {
      await api.put(`/suppliers/${selectedSupplier.supplier_id}`, values)
      message.success("Supplier updated successfully")
      setEditModal(false)
      editForm.resetFields()
      fetchSuppliers()
    } catch (err) {
      message.error(err.response?.data?.detail || "Failed to update supplier")
    }
  }

  const columns = [
    { title: "ID",            dataIndex: "supplier_id",   key: "supplier_id" },
    { title: "Supplier Name", dataIndex: "supplier_name", key: "supplier_name" },
    { title: "Email",         dataIndex: "email",         key: "email" },
    { title: "Phone",         dataIndex: "phone",         key: "phone" },
    { title: "Address",       dataIndex: "address",       key: "address" },
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
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        isAdmin && (
          <Button size="small" onClick={() => handleEdit(record)}>Edit</Button>
        )
      )
    }
  ]

  return (
    <AppLayout>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
        <h2>Suppliers</h2>
        {isAdmin && (
          <Button type="primary" onClick={() => setCreateModal(true)}>+ Create Supplier</Button>
        )}
      </div>

      <Table dataSource={suppliers} columns={columns} rowKey="supplier_id" loading={loading} />

      {/* Create Modal */}
      <Modal
        title="Create Supplier"
        open={createModal}
        onCancel={() => { setCreateModal(false); createForm.resetFields() }}
        onOk={() => createForm.submit()}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="supplier_name" label="Supplier Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title={`Edit Supplier — ${selectedSupplier?.supplier_name}`}
        open={editModal}
        onCancel={() => { setEditModal(false); editForm.resetFields() }}
        onOk={() => editForm.submit()}
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdate}>
          <Form.Item name="supplier_name" label="Supplier Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}

export default Suppliers