-- SQL Schema for Multi-Shop Sales Tracking Platform

-- 1. Profiles (Extends Supabase Auth users)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Shops
CREATE TABLE shops (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    parent_shop_id UUID REFERENCES shops(id) ON DELETE SET NULL, -- For child branches
    name TEXT NOT NULL,
    address TEXT,
    contact_details TEXT,
    business_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Index for parent-child relationship tracking
CREATE INDEX idx_shops_parent_id ON shops(parent_shop_id);

-- 3. User-Shop Roles (Multi-tenant access control)
CREATE TYPE user_role AS ENUM ('owner', 'branch_manager', 'attendant');

CREATE TABLE user_shop_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
    role user_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, shop_id)
);

-- Enforce one-store-per-branch-manager constraint
CREATE UNIQUE INDEX idx_one_store_per_branch_manager ON user_shop_roles (user_id) WHERE role = 'branch_manager';

-- 4. Products (Modified for Variations and Uniqueness)
CREATE TABLE products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
    parent_id UUID REFERENCES products(id) ON DELETE CASCADE, -- For variations
    name TEXT NOT NULL,
    variation_name TEXT, -- e.g., 'Large', 'Red', 'Plastic'
    description TEXT,
    price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'GHS',
    stock_count INTEGER DEFAULT 0 CHECK (stock_count >= 0),
    deleted_at TIMESTAMP WITH TIME ZONE, -- Soft delete flag
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    -- Enforce deterministic uniqueness: same name + price + variation per shop
    UNIQUE (shop_id, name, price, variation_name)
);

-- Migration script logic (to be run manually in SQL editor)
/*
-- 1. Create temporary table for deduplication
CREATE TEMP TABLE products_dedup AS
SELECT 
    min(id) as id,
    shop_id,
    name,
    price,
    variation_name,
    sum(stock_count) as total_stock
FROM products
GROUP BY shop_id, name, price, variation_name;

-- 2. Update foreign key references in sale_items to the "winner" id
UPDATE sale_items si
SET product_id = d.id
FROM products p
JOIN products_dedup d ON p.shop_id = d.shop_id AND p.name = d.name AND p.price = d.price AND COALESCE(p.variation_name, '') = COALESCE(d.variation_name, '')
WHERE si.product_id = p.id AND si.product_id != d.id;

-- 3. Delete duplicates from products
DELETE FROM products WHERE id NOT IN (SELECT id FROM products_dedup);

-- 4. Update stock on the winners
UPDATE products p
SET stock_count = d.total_stock
FROM products_dedup d
WHERE p.id = d.id;
*/

-- Enable fuzzy search extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Indexes for performance
CREATE INDEX idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
CREATE INDEX idx_products_shop_id ON products(shop_id);
CREATE INDEX idx_products_parent_id ON products(parent_id);

-- Indexes for performance on sales history
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_payment_method ON sales(payment_method);
CREATE INDEX IF NOT EXISTS idx_sales_receipt_number ON sales(receipt_number);

-- 5. Sales (Enhanced with payment details)
CREATE TABLE sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL DEFAULT 'cash', -- 'cash', 'card', 'momo'
    payment_status TEXT NOT NULL DEFAULT 'completed',
    receipt_number TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Function to generate receipt numbers
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.receipt_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('receipt_seq')::text, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS receipt_seq;

CREATE TRIGGER trg_generate_receipt_number
BEFORE INSERT ON sales
FOR EACH ROW
WHEN (NEW.receipt_number IS NULL)
EXECUTE FUNCTION generate_receipt_number();

-- 6. Sale Items
CREATE TABLE sale_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(12,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 7. Invites
CREATE TABLE invites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE, -- Source shop (the parent)
    target_shop_id UUID REFERENCES shops(id) ON DELETE CASCADE, -- The branch being joined (if specific)
    role user_role NOT NULL DEFAULT 'branch_manager',
    token TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('shop_specific', 'general')),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 10. Inventory Audit (Detailed tracking)
CREATE TABLE inventory_audit (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'ADD', 'DELETE', 'UPDATE_PRICE', 'UPDATE_STOCK'
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 11. Pending Tasks (Reminders for new items)
CREATE TABLE pending_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    due_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'DISMISSED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Row Level Security for new tables
ALTER TABLE inventory_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs for their shops" ON inventory_audit FOR SELECT
USING (EXISTS (
    SELECT 1 FROM products p
    JOIN user_shop_roles usr ON p.shop_id = usr.shop_id
    WHERE p.id = inventory_audit.product_id AND usr.user_id = auth.uid()
));

CREATE POLICY "Users can manage their own tasks" ON pending_tasks FOR ALL
USING (user_id = auth.uid());

-- 12. Checkout Notifications (Persistent)
CREATE TABLE checkout_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info', -- 'success', 'warning', 'info'
    is_read BOOLEAN DEFAULT FALSE,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE checkout_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own notifications" ON checkout_notifications FOR ALL
USING (user_id = auth.uid());

-- Transactional Sale Recording Function (v4: with payment details and manual prices)
CREATE OR REPLACE FUNCTION record_sale_v4(
    p_shop_id UUID,
    p_user_id UUID,
    p_total_amount DECIMAL,
    p_payment_method TEXT,
    p_items JSONB -- [{product_id, name, quantity, unit_price, is_new}]
) RETURNS UUID AS $$
DECLARE
    v_sale_id UUID;
    v_item RECORD;
    v_product_id UUID;
    v_notification_msg TEXT := 'Checkout completed for: ';
    v_item_count INTEGER := 0;
BEGIN
    -- 1. Insert into sales
    INSERT INTO sales (shop_id, user_id, total_amount, payment_method)
    VALUES (p_shop_id, p_user_id, p_total_amount, p_payment_method)
    RETURNING id INTO v_sale_id;

    -- 2. Process items
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, name TEXT, quantity INTEGER, unit_price DECIMAL, is_new BOOLEAN)
    LOOP
        v_product_id := v_item.product_id;
        v_item_count := v_item_count + 1;
        
        IF v_item_count <= 3 THEN
            v_notification_msg := v_notification_msg || v_item.name || ' (x' || v_item.quantity || '), ';
        END IF;

        -- Handle unknown or manual price items (is_new flag)
        IF v_item.is_new OR v_product_id IS NULL THEN
            -- If product_id is null, it's a completely new item or one with manual price
            INSERT INTO products (shop_id, name, variation_name, price, stock_count)
            VALUES (p_shop_id, v_item.name, NULL, v_item.unit_price, 0)
            RETURNING id INTO v_product_id;
            
            -- Audit creation
            INSERT INTO inventory_audit (product_id, user_id, action, new_value)
            VALUES (v_product_id, p_user_id, 'ADD', jsonb_build_object('name', v_item.name, 'price', v_item.unit_price, 'stock', 0));
        ELSE
            -- Deduct stock for existing items
            PERFORM decrement_stock(v_product_id, v_item.quantity);
            
            -- Audit stock deduction
            INSERT INTO inventory_audit (product_id, user_id, action, old_value, new_value)
            VALUES (v_product_id, p_user_id, 'UPDATE_STOCK', 
                jsonb_build_object('stock_count', (SELECT stock_count + v_item.quantity FROM products WHERE id = v_product_id)),
                jsonb_build_object('stock_count', (SELECT stock_count FROM products WHERE id = v_product_id)));
        END IF;

        -- Insert sale item
        INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price)
        VALUES (v_sale_id, v_product_id, v_item.quantity, v_item.unit_price, v_item.quantity * v_item.unit_price);
    END LOOP;

    -- Finalize notification message
    IF v_item_count > 3 THEN
        v_notification_msg := v_notification_msg || 'and ' || (v_item_count - 3) || ' more...';
    ELSE
        v_notification_msg := rtrim(v_notification_msg, ', ');
    END IF;

    -- 3. Create persistent notification
    INSERT INTO checkout_notifications (user_id, shop_id, title, message, type, details)
    VALUES (p_user_id, p_shop_id, 'Successful Checkout', v_notification_msg || '. Total: ₵' || p_total_amount || ' via ' || p_payment_method, 'success', jsonb_build_object('sale_id', v_sale_id, 'total', p_total_amount));

    RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Stock Management Functions
CREATE OR REPLACE FUNCTION increment_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS void AS $$
BEGIN
    UPDATE products
    SET stock_count = stock_count + p_quantity
    WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS void AS $$
DECLARE
    v_current_stock INTEGER;
BEGIN
    SELECT stock_count INTO v_current_stock FROM products WHERE id = p_product_id FOR UPDATE;
    
    IF v_current_stock < p_quantity THEN
        RAISE EXCEPTION 'Insufficient stock';
    END IF;

    UPDATE products
    SET stock_count = stock_count - p_quantity
    WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
