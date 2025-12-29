-- Create reminders table for user notifications
CREATE TABLE public.reminders (
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

-- Enable RLS
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own reminders"
ON public.reminders FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own reminders"
ON public.reminders FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own reminders"
ON public.reminders FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own reminders"
ON public.reminders FOR DELETE
USING (user_id = auth.uid());

-- Create index for better performance
CREATE INDEX idx_reminders_user_id ON public.reminders(user_id);
CREATE INDEX idx_reminders_reminder_date ON public.reminders(reminder_date);
CREATE INDEX idx_reminders_active ON public.reminders(is_active);
