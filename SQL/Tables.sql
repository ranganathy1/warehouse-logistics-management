

-- USERS & ROLES


CREATE TABLE users (
    user_id       SERIAL          PRIMARY KEY,
    username      VARCHAR(100)    NOT NULL UNIQUE,
    password_hash TEXT            NOT NULL,
    is_active     BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE TABLE roles (
    role_id   SERIAL       PRIMARY KEY,
    role_name VARCHAR(50)  NOT NULL UNIQUE
);

INSERT INTO roles (role_name) VALUES
    ('Administrator'),
    ('Warehouse Staff'),
    ('Logistics Staff');

CREATE TABLE user_roles (
    user_id   INT  NOT NULL REFERENCES users(user_id)  ON DELETE CASCADE,
    role_id   INT  NOT NULL REFERENCES roles(role_id)  ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

--  META / DOCUMENT TYPES

CREATE TABLE document_types (
    document_type_id   SERIAL       PRIMARY KEY,
    document_name      VARCHAR(100) NOT NULL UNIQUE,
    description        TEXT
);

INSERT INTO document_types (document_name, description) VALUES
    ('Purchase Order',     'Outgoing order sent to a supplier for goods.'),
    ('Goods Receipt Note', 'Inbound receipt confirming supplier delivery.'),
    ('Sales Order',        'Outbound order created on behalf of a customer.'),
    ('Delivery Challan',   'Dispatch document assigning driver and vehicle to a shipment.');

--MASTER DATA

CREATE TABLE unit_of_measure (
    uom_id     SERIAL      PRIMARY KEY,
    uom_name   VARCHAR(50) NOT NULL UNIQUE,
    uom_symbol VARCHAR(10) NOT NULL
);

INSERT INTO unit_of_measure (uom_name, uom_symbol) VALUES
    ('Kilogram', 'kg'),
    ('Pieces',   'pcs'),
    ('Liters',   'L'),
    ('Meters',   'm'),
    ('Boxes',    'box');

CREATE TABLE suppliers (
    supplier_id   SERIAL       PRIMARY KEY,
    supplier_name VARCHAR(150) NOT NULL,
    email         VARCHAR(150),
    phone         VARCHAR(30),
    address       TEXT,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE customers (
    customer_id   SERIAL       PRIMARY KEY,
    customer_name VARCHAR(150) NOT NULL,
    phone         VARCHAR(30),
    address       TEXT,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE items (
    item_id        SERIAL          PRIMARY KEY,
    item_name      VARCHAR(200)    NOT NULL,
    description    TEXT,
    reorder_level  NUMERIC(12, 2)  NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
    uom_id         INT             NOT NULL REFERENCES unit_of_measure(uom_id),
    is_active      BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMP       NOT NULL DEFAULT NOW()
);

--  INVENTORY

CREATE TABLE stock_balance (
    item_id            INT             PRIMARY KEY REFERENCES items(item_id),
    available_quantity NUMERIC(12, 2)  NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
    reserved_quantity  NUMERIC(12, 2)  NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    last_updated       TIMESTAMP       NOT NULL DEFAULT NOW()
);

--PROCUREMENT FLOW

CREATE TABLE purchase_orders (
    po_id         SERIAL      PRIMARY KEY,
    supplier_id   INT         NOT NULL REFERENCES suppliers(supplier_id),
    created_by    INT         NOT NULL REFERENCES users(user_id),
    status        VARCHAR(30) NOT NULL DEFAULT 'Pending'
                              CHECK (status IN ('Pending', 'Partially_Received', 'Completed', 'Cancelled')),
    notes         TEXT,
    created_at    TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP   NOT NULL DEFAULT NOW(),
    received_at   TIMESTAMP
);

CREATE TABLE purchase_order_lines (
    po_line_id          SERIAL          PRIMARY KEY,
    po_id               INT             NOT NULL REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
    item_id             INT             NOT NULL REFERENCES items(item_id),
    ordered_quantity    NUMERIC(12, 2)  NOT NULL CHECK (ordered_quantity > 0),
    received_quantity   NUMERIC(12, 2)  NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
    pending_quantity    NUMERIC(12, 2)  GENERATED ALWAYS AS (ordered_quantity - received_quantity) STORED,
    unit_cost           NUMERIC(12, 2)  NOT NULL DEFAULT 0,
    line_total          NUMERIC(14, 2)  GENERATED ALWAYS AS (ordered_quantity * unit_cost) STORED,
    UNIQUE (po_id, item_id)
);

CREATE TABLE goods_receipts (
    grn_id       SERIAL      PRIMARY KEY,
    po_id        INT         NOT NULL REFERENCES purchase_orders(po_id),
    received_by  INT         NOT NULL REFERENCES users(user_id),
    status       VARCHAR(30) NOT NULL DEFAULT 'Draft'
                             CHECK (status IN ('Draft', 'Confirmed')),
    notes        TEXT,
    received_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE TABLE goods_receipt_lines (
    grn_line_id         SERIAL          PRIMARY KEY,
    grn_id              INT             NOT NULL REFERENCES goods_receipts(grn_id) ON DELETE CASCADE,
    item_id             INT             NOT NULL REFERENCES items(item_id),
    received_quantity   NUMERIC(12, 2)  NOT NULL CHECK (received_quantity > 0),
    UNIQUE (grn_id, item_id)
);

--SALES FLOW

CREATE TABLE sales_orders (
    so_id           SERIAL      PRIMARY KEY,
    customer_id     INT         NOT NULL REFERENCES customers(customer_id),
    created_by      INT         NOT NULL REFERENCES users(user_id),
    status          VARCHAR(30) NOT NULL DEFAULT 'Pending'
                                CHECK (status IN ('Pending', 'Processing', 'Packed', 'Shipped', 'Delivered', 'Cancelled')),
    payment_status  VARCHAR(30) NOT NULL DEFAULT 'Unpaid'
                                CHECK (payment_status IN ('Unpaid', 'Paid', 'Partial')),
    notes           TEXT,
    created_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE TABLE sales_order_lines (
    so_line_id        SERIAL          PRIMARY KEY,
    so_id             INT             NOT NULL REFERENCES sales_orders(so_id) ON DELETE CASCADE,
    item_id           INT             NOT NULL REFERENCES items(item_id),
    ordered_quantity  NUMERIC(12, 2)  NOT NULL CHECK (ordered_quantity > 0),
    shipped_quantity  NUMERIC(12, 2)  NOT NULL DEFAULT 0 CHECK (shipped_quantity >= 0),
    pending_quantity  NUMERIC(12, 2)  GENERATED ALWAYS AS (ordered_quantity - shipped_quantity) STORED,
    unit_price        NUMERIC(12, 2)  NOT NULL DEFAULT 0,
    line_total        NUMERIC(14, 2)  GENERATED ALWAYS AS (ordered_quantity * unit_price) STORED,
    UNIQUE (so_id, item_id)
);

CREATE TABLE delivery_challans (
    dc_id          SERIAL      PRIMARY KEY,
    so_id          INT         NOT NULL REFERENCES sales_orders(so_id),
    created_by     INT         NOT NULL REFERENCES users(user_id),
    driver_name    VARCHAR(150),
    vehicle_number VARCHAR(50),
    status         VARCHAR(30) NOT NULL DEFAULT 'Pending'
                               CHECK (status IN ('Pending', 'Dispatched', 'Delivered', 'Failed')),
    notes          TEXT,
    dispatched_at  TIMESTAMP,
    delivered_at   TIMESTAMP,
    created_at     TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE TABLE delivery_challan_lines (
    dc_line_id       SERIAL          PRIMARY KEY,
    dc_id            INT             NOT NULL REFERENCES delivery_challans(dc_id) ON DELETE CASCADE,
    item_id          INT             NOT NULL REFERENCES items(item_id),
    shipped_quantity NUMERIC(12, 2)  NOT NULL CHECK (shipped_quantity > 0),
    UNIQUE (dc_id, item_id)
);

