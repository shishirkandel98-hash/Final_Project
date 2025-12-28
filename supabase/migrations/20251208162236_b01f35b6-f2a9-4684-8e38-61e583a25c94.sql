-- Drop the restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create permissive policies for profiles
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage all profiles"
ON public.profiles FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Add policy for user_sessions to allow admins to view all
DROP POLICY IF EXISTS "Admins can manage all user sessions" ON public.user_sessions;
CREATE POLICY "Admins can view all user sessions"
ON public.user_sessions FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add policy for login_attempts admin view
DROP POLICY IF EXISTS "Admins can view login attempts" ON public.login_attempts;
CREATE POLICY "Admins can view all login attempts"
ON public.login_attempts FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));