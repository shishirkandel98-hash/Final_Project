-- Add email field to reminders table
ALTER TABLE public.reminders ADD COLUMN reminder_email TEXT;

-- Update existing reminders to use profile email as default
UPDATE public.reminders
SET reminder_email = profiles.email
FROM profiles
WHERE reminders.user_id = profiles.id AND reminder_email IS NULL;

-- Make the field required for new reminders
ALTER TABLE public.reminders ALTER COLUMN reminder_email SET NOT NULL;

-- Add check constraint to ensure valid email format
ALTER TABLE public.reminders ADD CONSTRAINT reminders_reminder_email_check
CHECK (reminder_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');