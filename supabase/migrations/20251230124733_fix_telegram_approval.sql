-- Fix Telegram bot email validation issue
-- Ensure all users are approved and can connect via Telegram

-- Approve all existing users
UPDATE public.profiles
SET approved = true, approved_at = NOW()
WHERE approved = false OR approved IS NULL;

-- Update the handle_new_user function to ensure proper approval
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    first_name,
    last_name,
    phone,
    country,
    currency,
    approved,
    approved_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'country', ''),
    COALESCE(NEW.raw_user_meta_data->>'currency', 'NPR'),
    true,  -- Auto-approve all users
    NOW()  -- Set approved_at timestamp
  );

  -- Assign role based on email
  IF NEW.email = 'shishirxkandel@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;