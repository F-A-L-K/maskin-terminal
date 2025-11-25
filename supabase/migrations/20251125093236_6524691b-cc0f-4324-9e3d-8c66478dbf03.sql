-- Create verktygshanteringssystem_kompenseringar_nuvarande table
CREATE TABLE public.verktygshanteringssystem_kompenseringar_nuvarande (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  maskin_id UUID NOT NULL,
  verktyg_koordinat_num TEXT NOT NULL,
  verktyg_längd_geometry DOUBLE PRECISION,
  verktyg_längd_wear DOUBLE PRECISION,
  verktyg_radie_geometry DOUBLE PRECISION,
  verktyg_radie_wear DOUBLE PRECISION,
  koord_x DOUBLE PRECISION,
  koord_y DOUBLE PRECISION,
  koord_z DOUBLE PRECISION,
  koord_c DOUBLE PRECISION,
  koord_b DOUBLE PRECISION,
  datum TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_maskin_id FOREIGN KEY (maskin_id) 
    REFERENCES public.verktygshanteringssystem_maskiner(id) 
    ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE public.verktygshanteringssystem_kompenseringar_nuvarande ENABLE ROW LEVEL SECURITY;

-- Create policy for public access
CREATE POLICY "Allow public access to kompenseringar_nuvarande" 
ON public.verktygshanteringssystem_kompenseringar_nuvarande 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create trigger for automatic updated_at timestamp
CREATE TRIGGER update_kompenseringar_nuvarande_updated_at
BEFORE UPDATE ON public.verktygshanteringssystem_kompenseringar_nuvarande
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index on maskin_id for better query performance
CREATE INDEX idx_kompenseringar_nuvarande_maskin_id 
ON public.verktygshanteringssystem_kompenseringar_nuvarande(maskin_id);

-- Create index on verktyg_koordinat_num for better query performance
CREATE INDEX idx_kompenseringar_nuvarande_koordinat 
ON public.verktygshanteringssystem_kompenseringar_nuvarande(verktyg_koordinat_num);