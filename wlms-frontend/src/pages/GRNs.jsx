import { useEffect, useState } from "react"
import { Table, Tag, Button, Modal,Form,Select,InputNumber,message,Descriptions,Divider,Popconfirm } from "antd"
import AppLayout from "../components/Layout"
import api from "../api/axios"

function GRNs() {
    const [grns, setGrns] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
    api.get("/grns")
        .then(res => { setGrns(res.data); setLoading(false) })
        .catch(() => setLoading(false))
    }, [])

    const columns = [
    { title: "GRN ID",      dataIndex: "grn_id",      key: "grn_id" },
    { title: "PO ID",       dataIndex: "po_id",        key: "po_id" },
    { title: "Received By", dataIndex: "received_by",  key: "received_by" },
    {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (status) => (
        <Tag color={status === "Confirmed" ? "green" : "orange"}>{status}</Tag>
        )
    },
    { title: "Received At", dataIndex: "received_at",  key: "received_at" },
    ]

    return (
    <AppLayout>
        <h2 style={{ marginBottom: "16px" }}>Goods Receipt Notes</h2>
        <Table dataSource={grns} columns={columns} rowKey="grn_id" loading={loading} />
    </AppLayout>
    )
}
export default GRNs