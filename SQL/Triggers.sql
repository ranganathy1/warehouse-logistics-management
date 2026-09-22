CREATE OR REPLACE FUNCTION fn_init_stock_balance()
RETURNS TRIGGER
LANGUAGE plpgsql AS
$$
BEGIN
    INSERT INTO stock_balance (item_id, available_quantity, reserved_quantity)
    VALUES (NEW.item_id, 0, 0)
    ON CONFLICT (item_id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_init_stock_balance
AFTER INSERT ON items
FOR EACH ROW
EXECUTE FUNCTION fn_init_stock_balance();

CREATE OR REPLACE FUNCTION fn_grn_confirm_stock()
RETURNS TRIGGER
LANGUAGE plpgsql AS
$$
DECLARE
    v_line         RECORD;
    v_ordered      NUMERIC(12,2);
    v_received     NUMERIC(12,2);
    v_all_complete BOOLEAN;
    v_new_status   VARCHAR(30);
BEGIN
    IF NEW.status = 'Confirmed' AND OLD.status <> 'Confirmed' THEN

        FOR v_line IN
            SELECT item_id, received_quantity
            FROM goods_receipt_lines
            WHERE grn_id = NEW.grn_id
        LOOP
            SELECT ordered_quantity, received_quantity
            INTO v_ordered, v_received
            FROM purchase_order_lines
            WHERE po_id = NEW.po_id
              AND item_id = v_line.item_id
            FOR UPDATE;

            IF v_received + v_line.received_quantity > v_ordered THEN
                RAISE EXCEPTION
                    'GRN exceeds PO quantity for item_id %', v_line.item_id;
            END IF;

            UPDATE stock_balance
            SET available_quantity = available_quantity + v_line.received_quantity
            WHERE item_id = v_line.item_id;

            UPDATE purchase_order_lines
            SET received_quantity = received_quantity + v_line.received_quantity
            WHERE po_id = NEW.po_id
              AND item_id = v_line.item_id;
        END LOOP;

        SELECT bool_and(pending_quantity = 0)
        INTO v_all_complete
        FROM purchase_order_lines
        WHERE po_id = NEW.po_id;

        IF v_all_complete THEN
            v_new_status := 'Completed';
        ELSE
            v_new_status := 'Partially_Received';
        END IF;

        UPDATE purchase_orders
        SET status     = v_new_status,
            received_at = CASE WHEN v_new_status = 'Completed' THEN NOW() ELSE received_at END
        WHERE po_id = NEW.po_id;

    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_grn_confirm_stock
AFTER UPDATE OF status ON goods_receipts
FOR EACH ROW
EXECUTE FUNCTION fn_grn_confirm_stock();

CREATE OR REPLACE FUNCTION fn_so_line_reserve_stock()
RETURNS TRIGGER
LANGUAGE plpgsql AS
$$
DECLARE
    v_available NUMERIC(12,2);
BEGIN
    SELECT available_quantity
    INTO   v_available
    FROM   stock_balance
    WHERE  item_id = NEW.item_id
    FOR UPDATE;

    IF v_available < NEW.ordered_quantity THEN
        RAISE EXCEPTION
            'Insufficient stock for item_id %. Available: %, Requested: %',
            NEW.item_id, v_available, NEW.ordered_quantity;
    END IF;

    UPDATE stock_balance
    SET    available_quantity = available_quantity - NEW.ordered_quantity,
           reserved_quantity  = reserved_quantity  + NEW.ordered_quantity
    WHERE  item_id = NEW.item_id;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_so_line_reserve_stock
AFTER INSERT ON sales_order_lines
FOR EACH ROW
EXECUTE FUNCTION fn_so_line_reserve_stock();

CREATE OR REPLACE FUNCTION fn_dc_dispatched()
RETURNS TRIGGER
LANGUAGE plpgsql AS
$$
DECLARE
    v_line         RECORD;
    v_ordered      NUMERIC(12,2);
    v_shipped      NUMERIC(12,2);
    v_all_complete BOOLEAN;
    v_new_status   VARCHAR(30);
BEGIN
    IF NEW.status = 'Dispatched' AND OLD.status <> 'Dispatched' THEN

        FOR v_line IN
            SELECT item_id, shipped_quantity
            FROM delivery_challan_lines
            WHERE dc_id = NEW.dc_id
        LOOP
            SELECT sol.ordered_quantity, sol.shipped_quantity
            INTO v_ordered, v_shipped
            FROM sales_order_lines sol
            JOIN delivery_challans dc ON dc.so_id = sol.so_id
            WHERE dc.dc_id = NEW.dc_id
              AND sol.item_id = v_line.item_id
            FOR UPDATE;

            IF v_shipped + v_line.shipped_quantity > v_ordered THEN
                RAISE EXCEPTION
                    'Shipment exceeds Sales Order quantity for item_id %', v_line.item_id;
            END IF;

            UPDATE stock_balance
            SET reserved_quantity = reserved_quantity - v_line.shipped_quantity
            WHERE item_id = v_line.item_id;

            UPDATE sales_order_lines
            SET shipped_quantity = shipped_quantity + v_line.shipped_quantity
            FROM delivery_challans dc
            WHERE dc.dc_id = NEW.dc_id
              AND sales_order_lines.so_id = dc.so_id
              AND sales_order_lines.item_id = v_line.item_id;
        END LOOP;

        SELECT bool_and(pending_quantity = 0)
        INTO v_all_complete
        FROM sales_order_lines
        WHERE so_id = NEW.so_id;

        v_new_status := CASE WHEN v_all_complete THEN 'Shipped' ELSE 'Processing' END;

        UPDATE sales_orders
        SET status = v_new_status
        WHERE so_id = NEW.so_id;

        UPDATE delivery_challans
        SET dispatched_at = NOW()
        WHERE dc_id = NEW.dc_id;

    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dc_dispatched
AFTER UPDATE OF status ON delivery_challans
FOR EACH ROW
EXECUTE FUNCTION fn_dc_dispatched();



CREATE OR REPLACE FUNCTION fn_dc_delivered()
RETURNS TRIGGER
LANGUAGE plpgsql AS
$$
DECLARE
    v_all_complete BOOLEAN;
BEGIN
    IF NEW.status = 'Delivered' AND OLD.status <> 'Delivered' THEN

        UPDATE delivery_challans
        SET delivered_at = NOW()
        WHERE dc_id = NEW.dc_id;

        SELECT bool_and(pending_quantity = 0)
        INTO v_all_complete
        FROM sales_order_lines
        WHERE so_id = NEW.so_id;

        IF v_all_complete THEN
            UPDATE sales_orders
            SET status = 'Delivered'
            WHERE so_id = NEW.so_id;
        END IF;

    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dc_delivered
AFTER UPDATE OF status ON delivery_challans
FOR EACH ROW
EXECUTE FUNCTION fn_dc_delivered();




CREATE OR REPLACE FUNCTION fn_stamp_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS
$$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_so_updated_at
BEFORE UPDATE ON sales_orders
FOR EACH ROW
EXECUTE FUNCTION fn_stamp_updated_at();

CREATE TRIGGER trg_po_updated_at
BEFORE UPDATE ON purchase_orders
FOR EACH ROW
EXECUTE FUNCTION fn_stamp_updated_at();




CREATE OR REPLACE FUNCTION fn_stamp_stock_last_updated()
RETURNS TRIGGER
LANGUAGE plpgsql AS
$$
BEGIN
    NEW.last_updated := NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stock_last_updated
BEFORE UPDATE ON stock_balance
FOR EACH ROW
EXECUTE FUNCTION fn_stamp_stock_last_updated();