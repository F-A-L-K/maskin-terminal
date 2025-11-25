-- Create compensation table
CREATE TABLE public.verktygshanteringssystem_kompenseringar (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID NOT NULL REFERENCES public.verktygshanteringssystem_maskiner(id) ON DELETE CASCADE,
  tool_number INTEGER NOT NULL,
  cutter_radius_geometry INTEGER,
  cutter_radius_wear INTEGER,
  tool_length_geometry INTEGER,
  tool_length_wear INTEGER,
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.verktygshanteringssystem_kompenseringar ENABLE ROW LEVEL SECURITY;

-- Create policy for public access
CREATE POLICY "Allow public access to kompenseringar"
ON public.verktygshanteringssystem_kompenseringar
FOR ALL
USING (true)
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_kompenseringar_updated_at
BEFORE UPDATE ON public.verktygshanteringssystem_kompenseringar
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index on machine_id for better query performance
CREATE INDEX idx_kompenseringar_machine_id ON public.verktygshanteringssystem_kompenseringar(machine_id);

-- Create index on tool_number for better query performance
CREATE INDEX idx_kompenseringar_tool_number ON public.verktygshanteringssystem_kompenseringar(tool_number);