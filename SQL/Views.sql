
--STOCK STATUS (LIVE INVENTORY)

CREATE OR REPLACE VIEW vw_stock_status AS
SELECT
    i.item_id,
    i.item_name,
    u.uom_symbol,
    sb.available_quantity,
    sb.reserved_quantity,
    (sb.available_quantity + sb.reserved_quantity) AS total_on_hand,
    i.reorder_level,
    CASE
        WHEN sb.available_quantity <= i.reorder_level THEN TRUE
        ELSE FALSE
    END AS is_low_stock,
    sb.last_updated
FROM stock_balance sb
JOIN items i ON i.item_id = sb.item_id
JOIN unit_of_measure u ON u.uom_id = i.uom_id
WHERE i.is_active = TRUE;


--PURCHASE ORDER FULL VIEW

CREATE OR REPLACE VIEW vw_purchase_order_full AS
SELECT
    po.po_id,
    po.status AS po_status,
    po.created_at,
    po.updated_at,
    po.received_at,
    s.supplier_id,
    s.supplier_name,
    u.username AS created_by,
    pol.po_line_id,
    i.item_id,
    i.item_name,
    pol.ordered_quantity,
    pol.received_quantity,
    pol.pending_quantity,
    pol.unit_cost,
    pol.line_total,
    um.uom_symbol
FROM purchase_orders po
JOIN suppliers s ON s.supplier_id = po.supplier_id
JOIN users u ON u.user_id = po.created_by
JOIN purchase_order_lines pol ON pol.po_id = po.po_id
JOIN items i ON i.item_id = pol.item_id
JOIN unit_of_measure um ON um.uom_id = i.uom_id;

--  V3 — GRN FULL VIEW

CREATE OR REPLACE VIEW vw_grn_full AS
SELECT
    gr.grn_id,
    gr.po_id,
    gr.status AS grn_status,
    gr.received_at,
    u.username AS received_by,
    grl.grn_line_id,
    i.item_id,
    i.item_name,
    grl.received_quantity,
    um.uom_symbol
FROM goods_receipts gr
JOIN users u ON u.user_id = gr.received_by
JOIN goods_receipt_lines grl ON grl.grn_id = gr.grn_id
JOIN items i ON i.item_id = grl.item_id
JOIN unit_of_measure um ON um.uom_id = i.uom_id;


-- SALES ORDER FULL VIEW

CREATE OR REPLACE VIEW vw_sales_order_full AS
SELECT
    so.so_id,
    so.status AS so_status,
    so.payment_status,
    so.created_at,
    so.updated_at,
    c.customer_id,
    c.customer_name,
    c.phone AS customer_phone,
    u.username AS created_by,
    sol.so_line_id,
    i.item_id,
    i.item_name,
    sol.ordered_quantity,
    sol.shipped_quantity,
    sol.pending_quantity,
    sol.unit_price,
    sol.line_total,
    um.uom_symbol
FROM sales_orders so
JOIN customers c ON c.customer_id = so.customer_id
JOIN users u ON u.user_id = so.created_by
JOIN sales_order_lines sol ON sol.so_id = so.so_id
JOIN items i ON i.item_id = sol.item_id
JOIN unit_of_measure um ON um.uom_id = i.uom_id;


--DELIVERY CHALLAN FULL VIEW

CREATE OR REPLACE VIEW vw_delivery_challan_full AS
SELECT
    dc.dc_id,
    dc.so_id,
    dc.status AS dc_status,
    dc.driver_name,
    dc.vehicle_number,
    dc.dispatched_at,
    dc.delivered_at,
    dc.created_at,
    u.username AS created_by,
    c.customer_name,
    dcl.dc_line_id,
    i.item_id,
    i.item_name,
    dcl.shipped_quantity,
    um.uom_symbol
FROM delivery_challans dc
JOIN sales_orders so ON so.so_id = dc.so_id
JOIN customers c ON c.customer_id = so.customer_id
JOIN users u ON u.user_id = dc.created_by
JOIN delivery_challan_lines dcl ON dcl.dc_id = dc.dc_id
JOIN items i ON i.item_id = dcl.item_id
JOIN unit_of_measure um ON um.uom_id = i.uom_id;


--LOW STOCK ALERT

CREATE OR REPLACE VIEW vw_low_stock_alerts AS
SELECT
    item_id,
    item_name,
    uom_symbol,
    available_quantity,
    reorder_level,
    (reorder_level - available_quantity) AS shortage_quantity,
    last_updated
FROM vw_stock_status
WHERE is_low_stock = TRUE
ORDER BY shortage_quantity DESC;


-- ADMIN DASHBOARD

CREATE OR REPLACE VIEW vw_admin_dashboard AS
SELECT
    (SELECT COUNT(*) FROM sales_orders)                                         AS total_sales_orders,
    (SELECT COUNT(*) FROM sales_orders WHERE status = 'Pending')                AS so_pending,
    (SELECT COUNT(*) FROM sales_orders WHERE status = 'Processing')             AS so_processing,
    (SELECT COUNT(*) FROM sales_orders WHERE status = 'Packed')                 AS so_packed,
    (SELECT COUNT(*) FROM sales_orders WHERE status IN ('Shipped','Delivered')) AS so_completed,

    (SELECT COUNT(*) FROM purchase_orders)                                       AS total_purchase_orders,
    (SELECT COUNT(*) FROM purchase_orders WHERE status = 'Pending')             AS po_pending,
    (SELECT COUNT(*) FROM purchase_orders WHERE status = 'Partially_Received')  AS po_partial,

    (SELECT COUNT(*) FROM vw_stock_status)                                       AS total_items,
    (SELECT COUNT(*) FROM vw_low_stock_alerts)                                   AS low_stock_items,

    (SELECT COUNT(*) FROM delivery_challans WHERE status = 'Dispatched')        AS in_transit,

    -- Only fully Paid orders count as collected
    (SELECT COALESCE(SUM(sol.shipped_quantity * sol.unit_price), 0)
     FROM sales_order_lines sol
     JOIN sales_orders so ON so.so_id = sol.so_id
     WHERE so.payment_status = 'Paid')                                          AS revenue_collected,

    -- Unpaid AND Partial both count as pending
    (SELECT COALESCE(SUM(sol.shipped_quantity * sol.unit_price), 0)
     FROM sales_order_lines sol
     JOIN sales_orders so ON so.so_id = sol.so_id
     WHERE so.payment_status IN ('Unpaid', 'Partial'))                          AS revenue_pending;