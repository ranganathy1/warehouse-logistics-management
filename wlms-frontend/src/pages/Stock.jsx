import { useEffect, useState } from 'react';
import { Table, Tag } from 'antd';
import AppLayout from '../components/Layout';
import api from '../api/axios';

function Stock() {
    const [stock, setStock] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/stock')
            .then(res => {
                setStock(res.data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [])
    
    const columns = [
        { title: "Item",           dataIndex: "item_name",          key: "item_name" },
        { title: "UOM",            dataIndex: "uom_symbol",         key: "uom_symbol" },
        { title: "Available",      dataIndex: "available_quantity", key: "available_quantity" },
        { title: "Reserved",       dataIndex: "reserved_quantity",  key: "reserved_quantity" },
        { title: "Total On Hand",  dataIndex: "total_on_hand",      key: "total_on_hand" },
        { title: "Reorder Level",  dataIndex: "reorder_level",      key: "reorder_level" },
        {
        title: "Status",
        dataIndex: "is_low_stock",
        key: "is_low_stock",
        render: (is_low_stock) => (
            <Tag color={is_low_stock ? "red" : "green"}>
            {is_low_stock ? "Low Stock" : "OK"}
            </Tag>
        )
        },
    ]
    return (
        <AppLayout>
            <h2 style={{ marginBottom: "16px" }}>Stock Status</h2>
            <Table dataSource={stock} columns={columns} rowKey="item_id" loading={loading} />
        </AppLayout>
    )
}
export default Stock;