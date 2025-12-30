-- Add timezone column to reminders table
ALTER TABLE public.reminders ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC+5:45';

-- Add check constraint to ensure valid timezone format
ALTER TABLE public.reminders ADD CONSTRAINT reminders_timezone_check
CHECK (timezone ~* '^UTC[+-][0-9]{1,2}:[0-9]{2}$');