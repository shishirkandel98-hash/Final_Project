-- Make admin role hardcore - only shishirxkandel@gmail.com can be admin
-- Update has_role function to only check email for admin role, not the user_roles table

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    CASE
      WHEN _role = 'admin' THEN EXISTS (
        SELECT 1
        FROM auth.users
        WHERE id = _user_id AND email = 'shishirxkandel@gmail.com'
      )
      ELSE EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
      )
    END
$$;

-- Remove any existing admin roles from user_roles table (except for the hardcoded admin)
DELETE FROM public.user_roles
WHERE role = 'admin'
  AND user_id NOT IN (
    SELECT id FROM auth.users WHERE email = 'shishirxkandel@gmail.com'
  );

-- Add trigger to prevent inserting admin roles for non-admin emails
CREATE OR REPLACE FUNCTION public.prevent_admin_role_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- If trying to insert/update admin role
  IF NEW.role = 'admin' THEN
    -- Check if the user is the hardcoded admin
    IF NOT EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = NEW.user_id AND email = 'shishirxkandel@gmail.com'
    ) THEN
      RAISE EXCEPTION 'Cannot assign admin role to users other than shishirxkandel@gmail.com';
    END IF;
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