# Configuración de Supabase para Rastreo GPS

## Tabla: pet_locations

Esta tabla almacena las ubicaciones GPS de las mascotas.

### SQL para crear la tabla:

```sql
-- Crear tabla de ubicaciones de mascotas
CREATE TABLE pet_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  battery_level INTEGER CHECK (battery_level >= 0 AND battery_level <= 100),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsquedas rápidas por mascota
CREATE INDEX idx_pet_locations_pet_id ON pet_locations(pet_id);
CREATE INDEX idx_pet_locations_timestamp ON pet_locations(timestamp DESC);

-- Habilitar Row Level Security
ALTER TABLE pet_locations ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo pueden ver ubicaciones de sus propias mascotas
CREATE POLICY "Users can view their own pet locations"
ON pet_locations
FOR SELECT
USING (
  pet_id IN (
    SELECT id FROM pets WHERE user_id = auth.uid()
  )
);

-- Política: Los usuarios pueden insertar ubicaciones para sus propias mascotas
CREATE POLICY "Users can insert locations for their pets"
ON pet_locations
FOR INSERT
WITH CHECK (
  pet_id IN (
    SELECT id FROM pets WHERE user_id = auth.uid()
  )
);

-- Política: Los usuarios pueden actualizar ubicaciones de sus propias mascotas
CREATE POLICY "Users can update their own pet locations"
ON pet_locations
FOR UPDATE
USING (
  pet_id IN (
    SELECT id FROM pets WHERE user_id = auth.uid()
  )
);
```

## Tabla: pet_qr_codes

Esta tabla almacena códigos QR únicos para cada mascota.

### SQL para crear la tabla:

```sql
-- Crear tabla de códigos QR de mascotas
CREATE TABLE pet_qr_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id UUID NOT NULL UNIQUE REFERENCES pets(id) ON DELETE CASCADE,
  qr_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsquedas rápidas
CREATE INDEX idx_pet_qr_codes_pet_id ON pet_qr_codes(pet_id);
CREATE INDEX idx_pet_qr_codes_qr_code ON pet_qr_codes(qr_code);

-- Habilitar Row Level Security
ALTER TABLE pet_qr_codes ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver QR de sus propias mascotas
CREATE POLICY "Users can view their own pet QR codes"
ON pet_qr_codes
FOR SELECT
USING (
  pet_id IN (
    SELECT id FROM pets WHERE user_id = auth.uid()
  )
);

-- Política: Permitir lectura pública de QR (para escanear)
CREATE POLICY "Anyone can read QR codes"
ON pet_qr_codes
FOR SELECT
USING (true);

-- Política: Los usuarios pueden crear QR para sus mascotas
CREATE POLICY "Users can insert QR codes for their pets"
ON pet_qr_codes
FOR INSERT
WITH CHECK (
  pet_id IN (
    SELECT id FROM pets WHERE user_id = auth.uid()
  )
);
```

## Función para actualizar ubicación automáticamente

```sql
-- Función para mantener solo las últimas 100 ubicaciones por mascota
CREATE OR REPLACE FUNCTION cleanup_old_locations()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM pet_locations
  WHERE pet_id = NEW.pet_id
  AND id NOT IN (
    SELECT id FROM pet_locations
    WHERE pet_id = NEW.pet_id
    ORDER BY timestamp DESC
    LIMIT 100
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para ejecutar la limpieza
CREATE TRIGGER trigger_cleanup_locations
AFTER INSERT ON pet_locations
FOR EACH ROW
EXECUTE FUNCTION cleanup_old_locations();
```

## Cómo ejecutar estos scripts:

1. Ve a tu proyecto en Supabase
2. Navega a "SQL Editor"
3. Crea una nueva query
4. Copia y pega cada bloque SQL
5. Ejecuta los scripts en orden

## Nota importante:

Asegúrate de que la tabla `pets` ya existe antes de ejecutar estos scripts, ya que las tablas nuevas hacen referencia a ella.
