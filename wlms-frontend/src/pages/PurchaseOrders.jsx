import { useEffect, useState } from "react"
import { Table, Tag, Button, Modal, Form, Select, InputNumber, message, Descriptions, Divider, Popconfirm } from "antd"
import AppLayout from "../components/Layout"
import api from "../api/axios"

function PurchaseOrders() {
  const [pos, setPos] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  // Modal states
  const [createModal, setCreateModal] = useState(false)
  const [lineModal, setLineModal] = useState(false)
  const [detailModal, setDetailModal] = useState(false)

  const [selectedPO, setSelectedPO] = useState(null)      // PO being viewed
  const [activePOId, setActivePOId] = useState(null)      // PO we're adding lines to
  const [poDetail, setPODetail] = useState(null)           // full PO detail with lines

  const [createForm] = Form.useForm()
  const [lineForm] = Form.useForm()

  const user = JSON.parse(localStorage.getItem("user"))

  const fetchPOs = () => {
    api.get("/purchase-orders")
      .then(res => { setPos(res.data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchPOs()
    api.get("/suppliers").then(res => setSuppliers(res.data))
    api.get("/items").then(res => setItems(res.data))
  }, [])

  // Create PO header
  const handleCreatePO = async (values) => {
    try {
      const payload = {
        supplier_id: values.supplier_id,
        created_by:  user.user_id
      }
      const res = await api.post("/purchase-orders", payload)
      message.success(`PO #${res.data.po_id} created! Now add lines to it.`)
      setCreateModal(false)
      createForm.resetFields()
      setActivePOId(res.data.po_id)  // automatically open line modal
      setLineModal(true)
      fetchPOs()
    } catch (err) {
      message.error(err.response?.data?.detail || "Failed to create PO")
    }
  }

  // Add line to PO
  const handleAddLine = async (values) => {
    try {
      await api.post("/purchase-orders/lines", {
        po_id:     activePOId,
        item_id:   values.item_id,
        quantity:  values.quantity,
        unit_cost: values.unit_cost
      })
      message.success("Line added successfully")
      lineForm.resetFields()
    } catch (err) {
      message.error(err.response?.data?.detail || "Failed to add line")
    }
  }

  // View PO detail
  const handleViewDetail = async (po_id) => {
    try {
      const res = await api.get(`/purchase-orders/${po_id}`)
      setPODetail(res.data)
      setDetailModal(true)
    } catch (err) {
      message.error("Failed to load PO details")
    }
  }

  // Open line modal for existing PO
  const handleAddLinesToExisting = (po_id) => {
    setActivePOId(po_id)
    setLineModal(true)
  }

  const statusColors = {
    Pending:            "orange",
    Partially_Received: "blue",
    Completed:          "green",
    Cancelled:          "red"
  }

  const columns = [
    { title: "PO ID",      dataIndex: "po_id",         key: "po_id" },
    { title: "Supplier",   dataIndex: "supplier_name", key: "supplier_name" },
    { title: "Created By", dataIndex: "created_by",    key: "created_by" },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => <Tag color={statusColors[status]}>{status}</Tag>
    },
    { title: "Created At", dataIndex: "created_at",    key: "created_at" },
{
  title: "Actions",
  key: "actions",
  render: (_, record) => (
    <div style={{ display: "flex", gap: "8px" }}>
      <Button size="small" onClick={() => handleViewDetail(record.po_id)}>
        View
      </Button>
      {record.status === "Pending" && (
        <Button
          size="small"
          type="dashed"
          onClick={() => handleAddLinesToExisting(record.po_id)}
        >
          + Add Lines
        </Button>
      )}
      {record.status === "Pending" && (
        <Popconfirm
          title="Cancel this PO?"
          onConfirm={async () => {
            try {
              await api.post("/purchase-orders/cancel", { po_id: record.po_id })
              message.success("PO cancelled")
              fetchPOs()
            } catch (err) {
              message.error(err.response?.data?.detail || "Failed to cancel PO")
            }
          }}
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

  // Columns for lines inside detail modal
  const lineColumns = [
    { title: "Item",              dataIndex: "item_name",         key: "item_name" },
    { title: "UOM",               dataIndex: "uom_symbol",        key: "uom_symbol" },
    { title: "Ordered Qty",       dataIndex: "ordered_quantity",  key: "ordered_quantity" },
    { title: "Received Qty",      dataIndex: "received_quantity", key: "received_quantity" },
    { title: "Pending Qty",       dataIndex: "pending_quantity",  key: "pending_quantity" },
    { title: "Unit Cost",         dataIndex: "unit_cost",         key: "unit_cost" },
    { title: "Line Total",        dataIndex: "line_total",        key: "line_total" },
  ]

  return (
    <AppLayout>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
        <h2>Purchase Orders</h2>
        <Button type="primary" onClick={() => setCreateModal(true)}>+ Create PO</Button>
      </div>

      <Table dataSource={pos} columns={columns} rowKey="po_id" loading={loading} />

      {/* Create PO Modal */}
      <Modal
        title="Create Purchase Order"
        open={createModal}
        onCancel={() => { setCreateModal(false); createForm.resetFields() }}
        onOk={() => createForm.submit()}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreatePO}>
          <Form.Item name="supplier_id" label="Supplier" rules={[{ required: true }]}>
            <Select placeholder="Select supplier">
              {suppliers.filter(s => s.is_active).map(s => (
                <Select.Option key={s.supplier_id} value={s.supplier_id}>
                  {s.supplier_name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Lines Modal */}
      <Modal
        title={`Add Lines to PO #${activePOId}`}
        open={lineModal}
        onCancel={() => { setLineModal(false); lineForm.resetFields(); fetchPOs() }}
        onOk={() => { setLineModal(false); lineForm.resetFields(); fetchPOs() }}
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
          <Form.Item name="unit_cost" label="Unit Cost" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Button type="primary" onClick={() => lineForm.submit()} block>
            Add Line
          </Button>
        </Form>

        <Divider />
        <p style={{ color: "#888" }}>
          Keep adding lines. Click Done when finished.
        </p>
      </Modal>

      {/* Detail Modal */}
      <Modal
        title={`PO #${poDetail?.po_id} Details`}
        open={detailModal}
        onCancel={() => setDetailModal(false)}
        footer={null}
        width={800}
      >
        {poDetail && (
          <>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Supplier">{poDetail.supplier_name}</Descriptions.Item>
              <Descriptions.Item label="Created By">{poDetail.created_by}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={statusColors[poDetail.status]}>{poDetail.status}</Tag>
              </Descriptions.Item>
            </Descriptions>

            <Divider>Lines</Divider>

            <Table
              dataSource={poDetail.lines}
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

export default PurchaseOrders