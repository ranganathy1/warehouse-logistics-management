--Create Purchase Order header

CREATE OR REPLACE PROCEDURE sp_create_purchase_order(
    p_supplier_id INT,
    p_created_by  INT
)
LANGUAGE plpgsql AS
$$
BEGIN
    INSERT INTO purchase_orders (supplier_id, created_by)
    VALUES (p_supplier_id, p_created_by);
END;
$$;

--Add a line to a Purchase Order

CREATE OR REPLACE PROCEDURE sp_add_po_line(
    p_po_id     INT,
    p_item_id   INT,
    p_qty       NUMERIC,
    p_unit_cost NUMERIC
)
LANGUAGE plpgsql AS
$$
BEGIN
    INSERT INTO purchase_order_lines (po_id, item_id, ordered_quantity, unit_cost)
    VALUES (p_po_id, p_item_id, p_qty, p_unit_cost);
END;
$$;


--Create a GRN header

CREATE OR REPLACE PROCEDURE sp_create_grn(
    p_po_id       INT,
    p_received_by INT
)
LANGUAGE plpgsql AS
$$
BEGIN
    INSERT INTO goods_receipts (po_id, received_by, status)
    VALUES (p_po_id, p_received_by, 'Draft');
END;
$$;


--Add a line to a GRN

CREATE OR REPLACE PROCEDURE sp_add_grn_line(
    p_grn_id  INT,
    p_item_id INT,
    p_qty     NUMERIC
)
LANGUAGE plpgsql AS
$$
BEGIN
    INSERT INTO goods_receipt_lines (grn_id, item_id, received_quantity)
    VALUES (p_grn_id, p_item_id, p_qty);
END;
$$;


-- Confirm a GRN

CREATE OR REPLACE PROCEDURE sp_confirm_grn(
    p_grn_id INT
)
LANGUAGE plpgsql AS
$$
BEGIN
    UPDATE goods_receipts
    SET status = 'Confirmed'
    WHERE grn_id = p_grn_id;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_create_sales_order(
    p_customer_id INT,
    p_created_by  INT
)
LANGUAGE plpgsql AS
$$
BEGIN
    INSERT INTO sales_orders (customer_id, created_by)
    VALUES (p_customer_id, p_created_by);
END;
$$;


-- Add a line to a Sales Order

CREATE OR REPLACE PROCEDURE sp_add_so_line(
    p_so_id      INT,
    p_item_id    INT,
    p_qty        NUMERIC,
    p_unit_price NUMERIC
)
LANGUAGE plpgsql AS
$$
BEGIN
    INSERT INTO sales_order_lines (so_id, item_id, ordered_quantity, unit_price)
    VALUES (p_so_id, p_item_id, p_qty, p_unit_price);
END;
$$;


--Create Delivery Challan header

CREATE OR REPLACE PROCEDURE sp_create_dc(
    p_so_id      INT,
    p_created_by INT,
    p_driver     VARCHAR,
    p_vehicle    VARCHAR
)
LANGUAGE plpgsql AS
$$
DECLARE
    v_status VARCHAR(30);
BEGIN
    SELECT status INTO v_status
    FROM   sales_orders
    WHERE  so_id = p_so_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sales Order % not found.', p_so_id;
    END IF;

    IF v_status <> 'Packed' THEN
        RAISE EXCEPTION
            'SO % must be Packed before creating a DC. Current status: %.',
            p_so_id, v_status;
    END IF;

    INSERT INTO delivery_challans (so_id, created_by, driver_name, vehicle_number)
    VALUES (p_so_id, p_created_by, p_driver, p_vehicle);
END;
$$;

--Add a line to a Delivery Challan

CREATE OR REPLACE PROCEDURE sp_add_dc_line(
    p_dc_id   INT,
    p_item_id INT,
    p_qty     NUMERIC
)
LANGUAGE plpgsql AS
$$
BEGIN
    INSERT INTO delivery_challan_lines (dc_id, item_id, shipped_quantity)
    VALUES (p_dc_id, p_item_id, p_qty);
END;
$$;


-- Dispatch DC

CREATE OR REPLACE PROCEDURE sp_dispatch_dc(
    p_dc_id INT
)
LANGUAGE plpgsql AS
$$
BEGIN
    UPDATE delivery_challans
    SET status = 'Dispatched'
    WHERE dc_id = p_dc_id;
END;
$$;


--Deliver DC

CREATE OR REPLACE PROCEDURE sp_deliver_dc(
    p_dc_id INT
)
LANGUAGE plpgsql AS
$$
BEGIN
    UPDATE delivery_challans
    SET status = 'Delivered'
    WHERE dc_id = p_dc_id;
END;
$$;


-- Advance SO status

CREATE OR REPLACE PROCEDURE sp_advance_so_status(
    p_so_id INT
)
LANGUAGE plpgsql AS
$$
DECLARE
    v_current VARCHAR(30);
    v_next    VARCHAR(30);
BEGIN
    SELECT status INTO v_current
    FROM   sales_orders
    WHERE  so_id = p_so_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sales Order % not found.', p_so_id;
    END IF;

    v_next := CASE v_current
        WHEN 'Pending'    THEN 'Processing'
        WHEN 'Processing' THEN 'Packed'
        ELSE NULL
    END;

    IF v_next IS NULL THEN
        RAISE EXCEPTION
            'SO % cannot be advanced from status "%". Only Pending and Processing can be manually advanced.',
            p_so_id, v_current;
    END IF;

    UPDATE sales_orders
    SET    status = v_next
    WHERE  so_id  = p_so_id;

    RAISE NOTICE 'SO % moved from % → %.', p_so_id, v_current, v_next;
END;
$$;
-- Cancel Sales Order

CREATE OR REPLACE PROCEDURE sp_cancel_sales_order(
    p_so_id INT
)
LANGUAGE plpgsql AS
$$
DECLARE
    v_status VARCHAR(30);
    v_line   RECORD;
BEGIN
    SELECT status INTO v_status
    FROM   sales_orders
    WHERE  so_id = p_so_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sales Order % not found.', p_so_id;
    END IF;

    IF v_status IN ('Shipped', 'Delivered', 'Cancelled') THEN
        RAISE EXCEPTION
            'SO % cannot be cancelled. Current status: %.', p_so_id, v_status;
    END IF;

    FOR v_line IN
        SELECT item_id,
               ordered_quantity - shipped_quantity AS qty_to_release
        FROM   sales_order_lines
        WHERE  so_id = p_so_id
        AND    (ordered_quantity - shipped_quantity) > 0
    LOOP
        UPDATE stock_balance
        SET    available_quantity = available_quantity + v_line.qty_to_release,
               reserved_quantity  = reserved_quantity  - v_line.qty_to_release
        WHERE  item_id = v_line.item_id;
    END LOOP;

    UPDATE sales_orders
    SET    status = 'Cancelled'
    WHERE  so_id  = p_so_id;

    RAISE NOTICE 'SO % cancelled. Reserved stock released.', p_so_id;
END;
$$;

--Cancel Purchase Order

CREATE OR REPLACE PROCEDURE sp_cancel_purchase_order(
    p_po_id INT
)
LANGUAGE plpgsql AS
$$
DECLARE
    v_status VARCHAR(30);
BEGIN
    SELECT status INTO v_status
    FROM   purchase_orders
    WHERE  po_id = p_po_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase Order % not found.', p_po_id;
    END IF;

    IF v_status <> 'Pending' THEN
        RAISE EXCEPTION
            'PO % cannot be cancelled. Only Pending POs can be cancelled. Current status: %.',
            p_po_id, v_status;
    END IF;

    UPDATE purchase_orders
    SET    status = 'Cancelled'
    WHERE  po_id  = p_po_id;

    RAISE NOTICE 'PO % cancelled.', p_po_id;
END;
$$;

DO $$
DECLARE
    v_po_id  INT;
    v_grn_id INT;
BEGIN
    CALL sp_create_purchase_order(1, 1);
    SELECT MAX(po_id) INTO v_po_id FROM purchase_orders;

    CALL sp_add_po_line(v_po_id, 1, 100, 15.00);
    CALL sp_add_po_line(v_po_id, 2, 50,  8.50);

    CALL sp_create_grn(v_po_id, 1);
    SELECT MAX(grn_id) INTO v_grn_id FROM goods_receipts;

    CALL sp_add_grn_line(v_grn_id, 1, 100);
    CALL sp_add_grn_line(v_grn_id, 2, 50);

    CALL sp_confirm_grn(v_grn_id);

    RAISE NOTICE 'TXN1 complete. PO=%, GRN=%.', v_po_id, v_grn_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'TXN1 failed and rolled back: %', SQLERRM;
END;
$$;

DO $$
DECLARE
    v_so_id INT;
    v_dc_id INT;
BEGIN
    CALL sp_create_sales_order(1, 1);
    SELECT MAX(so_id) INTO v_so_id FROM sales_orders;

    CALL sp_add_so_line(v_so_id, 1, 10, 25.00);
    CALL sp_add_so_line(v_so_id, 2, 5,  12.00);

    CALL sp_advance_so_status(v_so_id);
    CALL sp_advance_so_status(v_so_id);

    CALL sp_create_dc(v_so_id, 1, 'Ahmed Khan', 'LHR-789');
    SELECT MAX(dc_id) INTO v_dc_id FROM delivery_challans;

    CALL sp_add_dc_line(v_dc_id, 1, 10);
    CALL sp_add_dc_line(v_dc_id, 2, 5);

    CALL sp_dispatch_dc(v_dc_id);
    CALL sp_deliver_dc(v_dc_id);

    RAISE NOTICE 'TXN2 complete. SO=%, DC=%.', v_so_id, v_dc_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'TXN2 failed and rolled back: %', SQLERRM;
END;
$$;

