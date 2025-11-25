-- Script para configurar Supabase Storage para fotos de mascotas
-- Ejecuta este script en el SQL Editor de Supabase Dashboard

-- 1. Crear el bucket 'pet-photos' si no existe
-- Ve a Storage > Create a new bucket en Supabase Dashboard
-- Nombre: pet-photos
-- Public: Yes (para que las URLs sean públicas)

-- 2. Políticas de seguridad para el bucket 'pet-photos'

-- Política para permitir a los usuarios subir fotos de sus mascotas
CREATE POLICY "Users can upload their pet photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pet-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir a los usuarios actualizar fotos de sus mascotas
CREATE POLICY "Users can update their pet photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'pet-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir a los usuarios eliminar fotos de sus mascotas
CREATE POLICY "Users can delete their pet photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'pet-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir a todos ver las fotos (bucket público)
CREATE POLICY "Anyone can view pet photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'pet-photos');
