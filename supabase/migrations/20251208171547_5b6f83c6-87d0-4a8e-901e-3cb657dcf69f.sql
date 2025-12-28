-- Create table to link Telegram users with website users
CREATE TABLE public.telegram_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  telegram_chat_id BIGINT NOT NULL UNIQUE,
  telegram_username TEXT,
  verification_code TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own telegram link"
ON public.telegram_links FOR SELECT
USING (user_id = auth.uid() OR (user_id IS NULL AND verified = false));

CREATE POLICY "Users can create their own telegram link"
ON public.telegram_links FOR INSERT
WITH CHECK (user_id = auth.uid() OR (user_id IS NULL AND verified = false));

CREATE POLICY "Users can update their own telegram link"
ON public.telegram_links FOR UPDATE
USING (user_id = auth.uid() OR (user_id IS NULL AND verified = false));

CREATE POLICY "Users can delete their own telegram link"
ON public.telegram_links FOR DELETE
USING (user_id = auth.uid() OR (user_id IS NULL AND verified = false));

CREATE POLICY "Admins can manage all telegram links"
ON public.telegram_links FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_telegram_links_chat_id ON public.telegram_links(telegram_chat_id);
CREATE INDEX idx_telegram_links_user_id ON public.telegram_links(user_id);