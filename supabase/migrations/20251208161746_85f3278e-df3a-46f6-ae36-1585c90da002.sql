-- Create vault_items table for storing encrypted sensitive data
CREATE TABLE public.vault_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  encrypted_data TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'credential',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vault_settings table for PIN storage
CREATE TABLE public.vault_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create login_attempts table for tracking and rate limiting
CREATE TABLE public.login_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  email TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_sessions table for tracking logged-in IPs
CREATE TABLE public.user_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_active TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.vault_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Vault items policies (users can only access their own)
CREATE POLICY "Users can view their own vault items"
ON public.vault_items FOR SELECT
USING (user_id = auth.uid() AND is_approved(auth.uid()));

CREATE POLICY "Users can create their own vault items"
ON public.vault_items FOR INSERT
WITH CHECK (user_id = auth.uid() AND is_approved(auth.uid()));

CREATE POLICY "Users can update their own vault items"
ON public.vault_items FOR UPDATE
USING (user_id = auth.uid() AND is_approved(auth.uid()));

CREATE POLICY "Users can delete their own vault items"
ON public.vault_items FOR DELETE
USING (user_id = auth.uid() AND is_approved(auth.uid()));

-- Vault settings policies
CREATE POLICY "Users can view their own vault settings"
ON public.vault_settings FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own vault settings"
ON public.vault_settings FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own vault settings"
ON public.vault_settings FOR UPDATE
USING (user_id = auth.uid());

-- Login attempts - public insert for tracking, no select for users
CREATE POLICY "Anyone can insert login attempts"
ON public.login_attempts FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can view login attempts"
ON public.login_attempts FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- User sessions policies
CREATE POLICY "Users can view their own sessions"
ON public.user_sessions FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "System can insert sessions"
ON public.user_sessions FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own sessions"
ON public.user_sessions FOR UPDATE
USING (user_id = auth.uid());

-- Create function to check rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(check_ip TEXT, window_minutes INT DEFAULT 2, max_attempts INT DEFAULT 5)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attempt_count INT;
BEGIN
  SELECT COUNT(*) INTO attempt_count
  FROM public.login_attempts
  WHERE ip_address = check_ip
    AND success = false
    AND created_at > now() - (window_minutes || ' minutes')::interval;
  
  RETURN attempt_count < max_attempts;
END;
$$;

-- Create function to clean old login attempts (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.login_attempts
  WHERE created_at < now() - interval '24 hours';
END;
$$;

-- Create storage bucket for vault files (only if it doesn't exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('vault-files', 'vault-files', false, 5242880)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for vault files
CREATE POLICY "Users can upload their own vault files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'vault-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own vault files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'vault-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own vault files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'vault-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Admin policies for vault
CREATE POLICY "Admins can manage all vault items"
ON public.vault_items FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage all vault settings"
ON public.vault_settings FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage all user sessions"
ON public.user_sessions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));