-- Update kategori check constraint to allow new category names
-- 1) Uppdatera befintliga rader från gamla namn till nya
UPDATE public.verktygshanteringssystem_kompenseringar_manuella SET kategori = '(1) Logga' WHERE kategori = 'Logga';
UPDATE public.verktygshanteringssystem_kompenseringar_manuella SET kategori = '(2) Matrixkod' WHERE kategori = 'Matrixkod';
UPDATE public.verktygshanteringssystem_kompenseringar_manuella SET kategori = '(3) Bakspår' WHERE kategori = 'Bakspår';
UPDATE public.verktygshanteringssystem_kompenseringar_manuella SET kategori = '(4) Framspår' WHERE kategori = 'Framspår';

-- 2) Ta bort gammal constraint och lägg till ny
ALTER TABLE public.verktygshanteringssystem_kompenseringar_manuella
DROP CONSTRAINT IF EXISTS verktygshanteringssystem_kompenseringar_manuella_kategori_check;

ALTER TABLE public.verktygshanteringssystem_kompenseringar_manuella
ADD CONSTRAINT verktygshanteringssystem_kompenseringar_manuella_kategori_check
CHECK (kategori IN ('(1) Logga', '(2) Matrixkod', '(3) Bakspår', '(4) Framspår'));
