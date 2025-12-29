-- Ensure reminder_email column exists in reminders table
DO $$
BEGIN
    -- Add column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'reminders'
        AND column_name = 'reminder_email'
    ) THEN
        ALTER TABLE public.reminders ADD COLUMN reminder_email TEXT;
    END IF;

    -- Update existing reminders to use profile email as default if not set
    UPDATE public.reminders
    SET reminder_email = profiles.email
    FROM profiles
    WHERE reminders.user_id = profiles.id
    AND (reminder_email IS NULL OR reminder_email = '');

    -- Make the field required for new reminders (only if not already set)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'reminders'
        AND column_name = 'reminder_email'
        AND is_nullable = 'YES'
    ) THEN
        -- First ensure all existing records have values
        UPDATE public.reminders
        SET reminder_email = profiles.email
        FROM profiles
        WHERE reminders.user_id = profiles.id
        AND reminder_email IS NULL;

        -- Then make it NOT NULL
        ALTER TABLE public.reminders ALTER COLUMN reminder_email SET NOT NULL;
    END IF;

    -- Add check constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_schema = 'public'
        AND constraint_name = 'reminders_reminder_email_check'
    ) THEN
        ALTER TABLE public.reminders ADD CONSTRAINT reminders_reminder_email_check
        CHECK (reminder_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
    END IF;
END $$;