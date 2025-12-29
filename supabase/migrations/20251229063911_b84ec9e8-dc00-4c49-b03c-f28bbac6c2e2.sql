-- Create a table for temporary Telegram authentication states
-- This table stores pending auth data without requiring a valid user_id
CREATE TABLE public.telegram_pending_auth (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_chat_id bigint NOT NULL UNIQUE,
  auth_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '10 minutes')
);

-- Enable RLS
ALTER TABLE public.telegram_pending_auth ENABLE ROW LEVEL SECURITY;

-- Allow the service role to manage this table (edge functions use service role)
-- No user-facing policies needed since this is only accessed by the edge function
CREATE POLICY "Service role can manage pending auth" 
ON public.telegram_pending_auth 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_telegram_pending_auth_chat_id ON public.telegram_pending_auth(telegram_chat_id);

-- Add cleanup function to remove expired auth sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_telegram_auth()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public.telegram_pending_auth
  WHERE expires_at < now();
END;
$$;