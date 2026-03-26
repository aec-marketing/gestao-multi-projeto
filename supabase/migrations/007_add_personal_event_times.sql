-- Migration 007: Adiciona suporte a horário parcial em eventos pessoais
-- Permite definir hora de início e fim quando o evento não ocupa o dia inteiro
-- NULL em ambos = dia inteiro (comportamento padrão preservado)

ALTER TABLE personal_events
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME;

-- Garante consistência: ambos presentes ou ambos ausentes, e fim > início
ALTER TABLE personal_events
  ADD CONSTRAINT personal_events_time_check
  CHECK (
    (start_time IS NULL AND end_time IS NULL) OR
    (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  );

COMMENT ON COLUMN personal_events.start_time IS 'Hora de início do evento (NULL = dia inteiro)';
COMMENT ON COLUMN personal_events.end_time   IS 'Hora de término do evento (NULL = dia inteiro)';
