-- Create table for compensation value differences (changes)
CREATE TABLE public.verktygshanteringssystem_kompensering_differanser (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID NOT NULL,
  tool_number INTEGER NOT NULL,
  field_name TEXT NOT NULL, -- 'cutter_radius_geometry', 'cutter_radius_wear', 'tool_length_geometry', 'tool_length_wear'
  old_value INTEGER,
  new_value INTEGER,
  difference INTEGER NOT NULL, -- new_value - old_value
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT verktygshanteringssystem_kompensering_differanser_machine_id_fkey 
    FOREIGN KEY (machine_id) 
    REFERENCES verktygshanteringssystem_maskiner (id) 
    ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_kompensering_differanser_machine_id 
  ON public.verktygshanteringssystem_kompensering_differanser(machine_id);

CREATE INDEX IF NOT EXISTS idx_kompensering_differanser_tool_number 
  ON public.verktygshanteringssystem_kompensering_differanser(tool_number);

CREATE INDEX IF NOT EXISTS idx_kompensering_differanser_changed_at 
  ON public.verktygshanteringssystem_kompensering_differanser(changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_kompensering_differanser_machine_tool 
  ON public.verktygshanteringssystem_kompensering_differanser(machine_id, tool_number);

-- Enable Row Level Security
ALTER TABLE public.verktygshanteringssystem_kompensering_differanser ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Allow public access to compensation differences" 
ON public.verktygshanteringssystem_kompensering_differanser 
FOR ALL 
USING (true) 
WITH CHECK (true);

