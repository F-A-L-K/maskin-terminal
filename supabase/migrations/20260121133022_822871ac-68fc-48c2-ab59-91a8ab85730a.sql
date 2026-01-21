-- Add column for extra parts count when switching in old tool
ALTER TABLE public.verktygshanteringssystem_verktygsbyteslista
ADD COLUMN extra_parts_old_tool integer NULL;