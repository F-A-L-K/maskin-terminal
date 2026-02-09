-- Add tillgång_kassationer column to machines table
ALTER TABLE public.verktygshanteringssystem_maskiner
ADD COLUMN tillgång_kassationer BOOLEAN DEFAULT true;

-- Update existing machines to have tillgång_kassationer enabled by default
UPDATE public.verktygshanteringssystem_maskiner
SET tillgång_kassationer = true
WHERE tillgång_kassationer IS NULL;
