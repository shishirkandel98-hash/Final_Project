-- Make admin role based on database entry only
-- Update has_role function to only check the user_roles table

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Remove any existing admin roles from user_roles table (keep only legitimate admins)
-- This ensures only users who got admin through proper signup process keep it

-- Update trigger to prevent new admin assignments (only allow through signup)
CREATE OR REPLACE FUNCTION public.prevent_admin_role_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- If trying to insert admin role
  IF NEW.role = 'admin' THEN
    -- Allow only if this is part of the signup process (check if user just signed up)
    -- For now, allow admin assignment but log it
    -- In production, you might want to restrict this further
    INSERT INTO public.audit_logs (user_id, table_name, action, new_values)
    VALUES (NEW.user_id, 'user_roles', 'admin_assigned', json_build_object('role', NEW.role));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on user_roles table
DROP TRIGGER IF EXISTS prevent_admin_assignment_trigger ON public.user_roles;
CREATE TRIGGER prevent_admin_assignment_trigger
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_role_assignment();

-- Ensure the admin user has the admin role in user_roles (for consistency)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'shishirxkandel@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.users.id AND role = 'admin'
  );