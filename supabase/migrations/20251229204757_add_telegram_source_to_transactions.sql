-- Add telegram_source column to transactions table
ALTER TABLE public.transactions ADD COLUMN telegram_source BOOLEAN DEFAULT false;

-- Add comment to explain the column
COMMENT ON COLUMN public.transactions.telegram_source IS 'Indicates if this transaction was created via Telegram bot';