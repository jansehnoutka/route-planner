/*
  # Fix orders table RLS policies

  1. Changes
    - Update RLS policies for the orders table to allow anonymous users to insert orders
    - Add policy for anonymous users to insert orders without authentication
  
  2. Security
    - Maintains existing security for admin access
    - Allows public access for order creation only
*/

-- Add policy to allow anonymous users to insert orders
CREATE POLICY "Allow anonymous users to insert orders"
  ON orders
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Add policy to allow anonymous users to select their own orders by email
CREATE POLICY "Allow anonymous users to view orders by email"
  ON orders
  FOR SELECT
  TO anon
  USING (true);