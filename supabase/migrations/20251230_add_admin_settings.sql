-- Create admin_settings table for managing system configuration
CREATE TABLE IF NOT EXISTS public.admin_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key VARCHAR(255) UNIQUE NOT NULL,
  setting_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  description TEXT
);

-- Enable RLS
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admins can read/write
CREATE POLICY "Admins can view admin settings"
ON public.admin_settings FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update admin settings"
ON public.admin_settings FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert admin settings"
ON public.admin_settings FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete admin settings"
ON public.admin_settings FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Create index for faster lookups
CREATE INDEX idx_admin_settings_key ON public.admin_settings(setting_key);

-- Add comment
COMMENT ON TABLE public.admin_settings IS 'System-wide configuration settings managed by admins (e.g., Telegram bot token)';
