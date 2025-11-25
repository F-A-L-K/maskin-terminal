-- Remove old columns from verktygshanteringssystem_kompenseringar
ALTER TABLE public.verktygshanteringssystem_kompenseringar
DROP COLUMN tool_number,
DROP COLUMN cutter_radius_geometry,
DROP COLUMN cutter_radius_wear,
DROP COLUMN tool_length_geometry,
DROP COLUMN tool_length_wear;

-- Add new columns to verktygshanteringssystem_kompenseringar
ALTER TABLE public.verktygshanteringssystem_kompenseringar
ADD COLUMN verktyg_koordinat_num TEXT NOT NULL,
ADD COLUMN verktyg_längd_geometry DOUBLE PRECISION,
ADD COLUMN verktyg_längd_wear DOUBLE PRECISION,
ADD COLUMN verktyg_radie_geometry DOUBLE PRECISION,
ADD COLUMN verktyg_radie_wear DOUBLE PRECISION,
ADD COLUMN koord_x DOUBLE PRECISION,
ADD COLUMN koord_y DOUBLE PRECISION,
ADD COLUMN koord_z DOUBLE PRECISION,
ADD COLUMN koord_c DOUBLE PRECISION,
ADD COLUMN koord_b DOUBLE PRECISION;

-- Create index on verktyg_koordinat_num for better query performance
CREATE INDEX idx_kompenseringar_koordinat 
ON public.verktygshanteringssystem_kompenseringar(verktyg_koordinat_num);