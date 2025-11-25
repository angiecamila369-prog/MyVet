-- Script para eliminar todas las conversaciones y mensajes del chat
-- Ejecuta este script en el Editor SQL de Supabase

-- Primero eliminar todos los mensajes (se eliminan automáticamente con CASCADE, pero por si acaso)
DELETE FROM chat_messages;

-- Luego eliminar todas las conversaciones
DELETE FROM chat_conversations;

-- Verificar que se eliminaron
SELECT COUNT(*) as total_conversaciones FROM chat_conversations;
SELECT COUNT(*) as total_mensajes FROM chat_messages;
