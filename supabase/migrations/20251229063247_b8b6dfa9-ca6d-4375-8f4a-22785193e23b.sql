-- Drop existing admin policies that allow viewing all transactions
DROP POLICY IF EXISTS "Admins can manage all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can manage all loans" ON public.loans;

-- Create new admin policies that only allow admins to manage their OWN transactions
CREATE POLICY "Admins can manage their own transactions" 
ON public.transactions 
FOR ALL 
USING (user_id = auth.uid() AND has_role(auth.uid(), 'admin'::app_role));

-- Create new admin policies that only allow admins to manage their OWN loans
CREATE POLICY "Admins can manage their own loans" 
ON public.loans 
FOR ALL 
USING (user_id = auth.uid() AND has_role(auth.uid(), 'admin'::app_role));