-- Enable realtime for transactions table
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;

-- Enable realtime for loans table  
ALTER PUBLICATION supabase_realtime ADD TABLE public.loans;