import { useEffect, useState } from "react"
import { Table, Tag, Button, Modal, Form, Input, Select, Popconfirm, message } from "antd"
import AppLayout from "../components/Layout"
import api from "../api/axios"

function Users() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [createModal, setCreateModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()

  const fetchUsers = () => {
    api.get("/users")
      .then(res => { setUsers(res.data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchUsers() }, [])

  const handleCreate = async (values) => {
    try {
      await api.post("/users", values)
      message.success("User created successfully")
      setCreateModal(false)
      createForm.resetFields()
      fetchUsers()
    } catch (err) {
      message.error(err.response?.data?.detail || "Failed to create user")
    }
  }

  const handleEdit = (record) => {
    setSelectedUser(record)
    editForm.setFieldsValue({
      role_name: record.role_name,
      is_active: record.is_active
    })
    setEditModal(true)
  }

  const handleUpdate = async (values) => {
    try {
      await api.put(`/users/${selectedUser.user_id}`, values)
      message.success("User updated successfully")
      setEditModal(false)
      editForm.resetFields()
      fetchUsers()
    } catch (err) {
      message.error(err.response?.data?.detail || "Failed to update user")
    }
  }

  const handleDeactivate = async (user_id) => {
    try {
      await api.delete(`/users/${user_id}`)
      message.success("User deactivated")
      fetchUsers()
    } catch (err) {
      message.error(err.response?.data?.detail || "Failed to deactivate user")
    }
  }

  const roleColors = {
    Administrator:     "red",
    "Warehouse Staff": "blue",
    "Logistics Staff": "green"
  }

  const columns = [
    { title: "ID",       dataIndex: "user_id",   key: "user_id" },
    { title: "Username", dataIndex: "username",  key: "username" },
    {
      title: "Role",
      dataIndex: "role_name",
      key: "role_name",
      render: (role_name) => <Tag color={roleColors[role_name]}>{role_name}</Tag>
    },
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
        <div style={{ display: "flex", gap: "8px" }}>
          <Button size="small" onClick={() => handleEdit(record)}>Edit</Button>
          {record.is_active && (
            <Popconfirm
              title="Deactivate this user?"
              onConfirm={() => handleDeactivate(record.user_id)}
              okText="Yes"
              cancelText="No"
            >
              <Button danger size="small">Deactivate</Button>
            </Popconfirm>
          )}
        </div>
      )
    },
  ]

  return (
    <AppLayout>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
        <h2>Users</h2>
        <Button type="primary" onClick={() => setCreateModal(true)}>+ Create User</Button>
      </div>

      <Table dataSource={users} columns={columns} rowKey="user_id" loading={loading} />

      {/* Create Modal */}
      <Modal
        title="Create User"
        open={createModal}
        onCancel={() => { setCreateModal(false); createForm.resetFields() }}
        onOk={() => createForm.submit()}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="username" label="Username" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="role_name" label="Role" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="Administrator">Administrator</Select.Option>
              <Select.Option value="Warehouse Staff">Warehouse Staff</Select.Option>
              <Select.Option value="Logistics Staff">Logistics Staff</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title={`Edit User — ${selectedUser?.username}`}
        open={editModal}
        onCancel={() => { setEditModal(false); editForm.resetFields() }}
        onOk={() => editForm.submit()}
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdate}>
          <Form.Item name="role_name" label="Role">
            <Select>
              <Select.Option value="Administrator">Administrator</Select.Option>
              <Select.Option value="Warehouse Staff">Warehouse Staff</Select.Option>
              <Select.Option value="Logistics Staff">Logistics Staff</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="is_active" label="Status">
            <Select>
              <Select.Option value={true}>Active</Select.Option>
              <Select.Option value={false}>Inactive</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}

export default Users