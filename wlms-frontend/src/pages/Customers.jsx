import { useEffect, useState } from "react"
import { Table, Button, Modal, Form, Input, message } from "antd"
import AppLayout from "../components/Layout"
import api from "../api/axios"

function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [createModal, setCreateModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const user = JSON.parse(localStorage.getItem("user"))
  const isAdmin = user?.role === "Administrator"

  const fetchCustomers = () => {
    api.get("/customers")
      .then(res => { setCustomers(res.data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchCustomers() }, [])

  const handleCreate = async (values) => {
    try {
      await api.post("/customers", values)
      message.success("Customer created successfully")
      setCreateModal(false)
      createForm.resetFields()
      fetchCustomers()
    } catch (err) {
      message.error(err.response?.data?.detail || "Failed to create customer")
    }
  }

  const handleEdit = (record) => {
    setSelectedCustomer(record)
    editForm.setFieldsValue({
      customer_name: record.customer_name,
      phone:         record.phone,
      address:       record.address
    })
    setEditModal(true)
  }

  const handleUpdate = async (values) => {
    try {
      await api.put(`/customers/${selectedCustomer.customer_id}`, values)
      message.success("Customer updated successfully")
      setEditModal(false)
      editForm.resetFields()
      fetchCustomers()
    } catch (err) {
      message.error(err.response?.data?.detail || "Failed to update customer")
    }
  }

  const columns = [
    { title: "ID",            dataIndex: "customer_id",   key: "customer_id" },
    { title: "Customer Name", dataIndex: "customer_name", key: "customer_name" },
    { title: "Phone",         dataIndex: "phone",         key: "phone" },
    { title: "Address",       dataIndex: "address",       key: "address" },
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
        <h2>Customers</h2>
        {isAdmin && (
          <Button type="primary" onClick={() => setCreateModal(true)}>+ Create Customer</Button>
        )}
      </div>

      <Table dataSource={customers} columns={columns} rowKey="customer_id" loading={loading} />

      {/* Create Modal */}
      <Modal
        title="Create Customer"
        open={createModal}
        onCancel={() => { setCreateModal(false); createForm.resetFields() }}
        onOk={() => createForm.submit()}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="customer_name" label="Customer Name" rules={[{ required: true }]}>
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
        title={`Edit Customer — ${selectedCustomer?.customer_name}`}
        open={editModal}
        onCancel={() => { setEditModal(false); editForm.resetFields() }}
        onOk={() => editForm.submit()}
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdate}>
          <Form.Item name="customer_name" label="Customer Name" rules={[{ required: true }]}>
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

export default Customers