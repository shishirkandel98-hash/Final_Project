-- Add loan_type column to loans table
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS loan_type text NOT NULL DEFAULT 'take';

-- Add constraint for loan_type values
ALTER TABLE public.loans ADD CONSTRAINT loans_type_check CHECK (loan_type IN ('give', 'take'));

-- Update existing loans to default type
UPDATE public.loans SET loan_type = 'take' WHERE loan_type IS NULL;