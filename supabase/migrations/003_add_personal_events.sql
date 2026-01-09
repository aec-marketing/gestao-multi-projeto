-- Migration: Add personal_events table
-- This migration documents the personal_events table structure
-- Note: This table may already exist in production, this ensures it's in migrations

-- Create personal_events table if it doesn't exist
CREATE TABLE IF NOT EXISTS personal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('medico', 'ferias', 'treinamento', 'licenca', 'feriado', 'outro')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_all_day BOOLEAN DEFAULT true,
  blocks_work BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),

  -- Constraint: end_date must be >= start_date
  CONSTRAINT personal_events_date_check CHECK (end_date >= start_date)
);

-- Create index on resource_id for faster queries
CREATE INDEX IF NOT EXISTS idx_personal_events_resource_id ON personal_events(resource_id);

-- Create index on date range for calendar queries
CREATE INDEX IF NOT EXISTS idx_personal_events_dates ON personal_events(start_date, end_date);

-- Create index on blocks_work for conflict detection
CREATE INDEX IF NOT EXISTS idx_personal_events_blocks_work ON personal_events(blocks_work) WHERE blocks_work = true;

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_personal_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_personal_events_updated_at
  BEFORE UPDATE ON personal_events
  FOR EACH ROW
  EXECUTE FUNCTION update_personal_events_updated_at();

-- Add comment
COMMENT ON TABLE personal_events IS 'Stores personal events (vacations, appointments, etc.) for resources that may block work allocations';
