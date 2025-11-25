# Setup de Supabase para Home Screen

Ejecuta estos comandos SQL en el Editor SQL de Supabase para crear las tablas necesarias:

## 1. Tabla de actividades diarias (daily_activities)

```sql
CREATE TABLE daily_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  walk_distance DECIMAL(5, 2) DEFAULT 0, -- en km
  meals_completed INTEGER DEFAULT 0,
  meals_total INTEGER DEFAULT 3,
  water_consumed DECIMAL(5, 2) DEFAULT 0, -- en litros
  sleep_hours DECIMAL(4, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Índices para optimizar consultas
CREATE INDEX idx_daily_activities_user_date ON daily_activities(user_id, date);
CREATE INDEX idx_daily_activities_pet ON daily_activities(pet_id);

-- RLS Policies
ALTER TABLE daily_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own daily activities"
  ON daily_activities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily activities"
  ON daily_activities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily activities"
  ON daily_activities FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own daily activities"
  ON daily_activities FOR DELETE
  USING (auth.uid() = user_id);
```

## 2. Tabla de recordatorios (reminders)

```sql
CREATE TABLE reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  reminder_date DATE NOT NULL,
  reminder_time TIME,
  type TEXT CHECK (type IN ('vet', 'medicine', 'grooming', 'vaccination', 'other')) DEFAULT 'other',
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_reminders_user ON reminders(user_id);
CREATE INDEX idx_reminders_pet ON reminders(pet_id);
CREATE INDEX idx_reminders_date ON reminders(reminder_date);

-- RLS Policies
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reminders"
  ON reminders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reminders"
  ON reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reminders"
  ON reminders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reminders"
  ON reminders FOR DELETE
  USING (auth.uid() = user_id);
```

## 3. Tabla de fotos de mascotas (pet_photos) - OPCIONAL si no existe

```sql
-- Solo ejecutar si no existe esta tabla
CREATE TABLE IF NOT EXISTS pet_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_pet_photos_pet ON pet_photos(pet_id);
CREATE INDEX idx_pet_photos_user ON pet_photos(user_id);

-- RLS Policies
ALTER TABLE pet_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pet photos"
  ON pet_photos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pet photos"
  ON pet_photos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pet photos"
  ON pet_photos FOR DELETE
  USING (auth.uid() = user_id);
```

## 4. Función para actualizar updated_at automáticamente

```sql
-- Crear función si no existe
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para daily_activities
CREATE TRIGGER update_daily_activities_updated_at
  BEFORE UPDATE ON daily_activities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Triggers para reminders
CREATE TRIGGER update_reminders_updated_at
  BEFORE UPDATE ON reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## 5. Insertar datos de ejemplo (opcional)

```sql
-- Insertar actividad diaria de ejemplo para hoy
INSERT INTO daily_activities (user_id, date, walk_distance, meals_completed, meals_total, water_consumed, sleep_hours)
VALUES (
  auth.uid(),
  CURRENT_DATE,
  2.4,
  3,
  3,
  1.2,
  8.0
);

-- Insertar recordatorio de ejemplo
INSERT INTO reminders (user_id, title, description, reminder_date, reminder_time, type)
VALUES (
  auth.uid(),
  'Vacuna anual',
  'Dr. García Veterinaria',
  CURRENT_DATE + INTERVAL '15 days',
  '10:00:00',
  'vet'
);
```

## Notas importantes:

1. Ejecuta estos scripts en orden desde el Editor SQL de Supabase
2. Las políticas RLS aseguran que cada usuario solo pueda ver/editar sus propios datos
3. Los triggers actualizan automáticamente el campo `updated_at`
4. Puedes insertar datos de ejemplo o dejar que la app los cree
