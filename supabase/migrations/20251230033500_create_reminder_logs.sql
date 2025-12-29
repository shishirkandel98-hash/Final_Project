-- Create reminder_logs table for tracking sent emails
CREATE TABLE public.reminder_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reminder_id UUID REFERENCES public.reminders(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  email_to TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent'
);

-- Enable RLS
ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own reminder logs"
ON public.reminder_logs FOR SELECT
USING (user_id = auth.uid());

-- Index
CREATE INDEX idx_reminder_logs_user_id ON public.reminder_logs(user_id);
CREATE INDEX idx_reminder_logs_created_at ON public.reminder_logs(sent_at);
