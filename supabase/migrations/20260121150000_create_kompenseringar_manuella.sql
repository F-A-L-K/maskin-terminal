-- Table for manual compensations (Logga / Matrixkod / Bakspår / Framspår), type X/Y/Vinkel, value, signature
CREATE TABLE public.verktygshanteringssystem_kompenseringar_manuella (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID NOT NULL REFERENCES public.verktygshanteringssystem_maskiner(id) ON DELETE CASCADE,
  kategori TEXT NOT NULL CHECK (kategori IN ('Logga', 'Matrixkod', 'Bakspår', 'Framspår')),
  typ TEXT NOT NULL CHECK (typ IN ('X', 'Y', 'Vinkel')),
  värde DOUBLE PRECISION NOT NULL,
  signatur TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.verktygshanteringssystem_kompenseringar_manuella ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to kompenseringar_manuella"
ON public.verktygshanteringssystem_kompenseringar_manuella
FOR ALL
USING (true)
WITH CHECK (true);

CREATE INDEX idx_kompenseringar_manuella_machine_id
ON public.verktygshanteringssystem_kompenseringar_manuella(machine_id);

CREATE INDEX idx_kompenseringar_manuella_created_at
ON public.verktygshanteringssystem_kompenseringar_manuella(created_at DESC);
