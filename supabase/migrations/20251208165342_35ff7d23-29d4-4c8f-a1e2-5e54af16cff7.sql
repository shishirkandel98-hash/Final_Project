-- Update handle_new_user function to auto-approve all users
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
    approved,
    approved_at,
    currency
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    true,  -- Auto-approve all users
    NOW(), -- Set approved_at timestamp
    COALESCE(NEW.raw_user_meta_data->>'currency', 'NPR')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Also update existing unapproved profiles to be approved
UPDATE public.profiles 
SET approved = true, approved_at = NOW() 
WHERE approved = false OR approved IS NULL;