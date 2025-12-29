-- Update telegram_links table to allow null user_id for pending authentication
ALTER TABLE public.telegram_links ALTER COLUMN user_id DROP NOT NULL;

-- Update RLS policies to allow operations on unverified entries with null user_id
DROP POLICY IF EXISTS "Users can view their own telegram link" ON public.telegram_links;
DROP POLICY IF EXISTS "Users can create their own telegram link" ON public.telegram_links;
DROP POLICY IF EXISTS "Users can update their own telegram link" ON public.telegram_links;
DROP POLICY IF EXISTS "Users can delete their own telegram link" ON public.telegram_links;
DROP POLICY IF EXISTS "Admins can manage all telegram links" ON public.telegram_links;

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