/*
  # Add payment fields to orders table

  1. Changes
    - Add payment_id, payment_status, and payment_url columns to orders table
*/

-- Add payment fields to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_url TEXT;

-- Create index on payment_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_payment_id ON orders(payment_id);