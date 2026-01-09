-- Migration: Update allocations table to use priority instead of percentage
-- This aligns the database schema with the application code

-- Remove percentage column if it exists (it's not used in the application)
ALTER TABLE allocations DROP COLUMN IF EXISTS percentage;

-- Add priority column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'allocations'
    AND column_name = 'priority'
  ) THEN
    ALTER TABLE allocations
    ADD COLUMN priority VARCHAR(10) DEFAULT 'media'
    CHECK (priority IN ('alta', 'media', 'baixa'));
  END IF;
END $$;

-- Make start_date and end_date nullable (they inherit from task dates)
ALTER TABLE allocations ALTER COLUMN start_date DROP NOT NULL;
ALTER TABLE allocations ALTER COLUMN end_date DROP NOT NULL;

-- Create unique constraint to prevent duplicate allocations
-- (same resource cannot be allocated to same task multiple times)
CREATE UNIQUE INDEX IF NOT EXISTS idx_allocations_unique_resource_task
  ON allocations(resource_id, task_id);

-- Create index for faster priority queries
CREATE INDEX IF NOT EXISTS idx_allocations_priority
  ON allocations(priority);

-- Add comment
COMMENT ON COLUMN allocations.priority IS 'Priority level for this allocation: alta (high), media (medium), baixa (low)';
