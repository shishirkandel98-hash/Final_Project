-- Add currency column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'NPR';

-- Update existing profiles to have NPR as default
UPDATE public.profiles SET currency = 'NPR' WHERE currency IS NULL;