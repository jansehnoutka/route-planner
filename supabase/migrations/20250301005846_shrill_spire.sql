/*
  # Create admin user

  1. Changes
    - Create an admin user with email and password
    - Set the user's role to 'admin' in the profiles table
  
  2. Security
    - Creates a secure admin account
    - Uses Supabase's built-in authentication
*/

-- This is a raw SQL function that will create an admin user
-- You'll need to run this in the Supabase SQL editor

-- First, create the user through Supabase auth
-- Replace 'admin@example.com' and 'securepassword' with your desired credentials
DO $$
DECLARE
  _uid uuid;
BEGIN
  -- Create the user in auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'admin@example.com',
    crypt('securepassword', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"admin"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO _uid;

  -- Ensure the user exists in the profiles table with admin role
  INSERT INTO public.profiles (id, email, role, created_at)
  VALUES (_uid, 'admin@example.com', 'admin', now())
  ON CONFLICT (id) DO UPDATE
  SET role = 'admin';
END;
$$;