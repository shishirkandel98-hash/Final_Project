-- 1. Create reminders table
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  reminder_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_count INTEGER DEFAULT 1,
  recurrence_interval TEXT, -- 'daily', 'weekly', 'monthly'
  recurrence_end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  email_sent_count INTEGER NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for reminders
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reminders
CREATE POLICY "Users can view their own reminders" ON public.reminders FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create their own reminders" ON public.reminders FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own reminders" ON public.reminders FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own reminders" ON public.reminders FOR DELETE USING (user_id = auth.uid());

-- Indices for reminders
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON public.reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_reminder_date ON public.reminders(reminder_date);
CREATE INDEX IF NOT EXISTS idx_reminders_active ON public.reminders(is_active);

-- 2. Add subject column (if it doesn't exist)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reminders' AND column_name = 'subject') THEN
    ALTER TABLE public.reminders ADD COLUMN subject TEXT;
    UPDATE public.reminders SET subject = 'Finance Reminder: ' || title WHERE subject IS NULL;
    ALTER TABLE public.reminders ALTER COLUMN subject SET NOT NULL;
  END IF;
END $$;

-- 3. Create reminder_logs table
CREATE TABLE IF NOT EXISTS public.reminder_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reminder_id UUID REFERENCES public.reminders(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  email_to TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent'
);

-- Enable RLS for reminder_logs
ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reminder_logs
CREATE POLICY "Users can view their own reminder logs" ON public.reminder_logs FOR SELECT USING (user_id = auth.uid());

-- Indices for reminder_logs
CREATE INDEX IF NOT EXISTS idx_reminder_logs_user_id ON public.reminder_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_created_at ON public.reminder_logs(sent_at);
