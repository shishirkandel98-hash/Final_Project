-- Create storage bucket for transaction images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('transaction-images', 'transaction-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for authenticated users to upload their own files
CREATE POLICY "Users can upload transaction images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'transaction-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create storage policy for viewing transaction images (public)
CREATE POLICY "Transaction images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'transaction-images');

-- Create policy for users to delete their own images
CREATE POLICY "Users can delete their own transaction images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'transaction-images' AND auth.uid()::text = (storage.foldername(name))[1]);