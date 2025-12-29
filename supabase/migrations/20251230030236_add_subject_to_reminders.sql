-- Add subject column to reminders table
ALTER TABLE public.reminders ADD COLUMN subject TEXT;

-- Update existing reminders to have a default subject
UPDATE public.reminders
SET subject = 'Finance Reminder: ' || title
WHERE subject IS NULL;

-- Make the field required for new reminders
ALTER TABLE public.reminders ALTER COLUMN subject SET NOT NULL;
