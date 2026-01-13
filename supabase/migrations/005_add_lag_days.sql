-- Add lag_days column to tasks table
-- This column stores buffer/slack days that don't affect the schedule
-- but provide flexibility for task execution

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS lag_days INTEGER DEFAULT 0;

-- Add comment explaining the field
COMMENT ON COLUMN tasks.lag_days IS 'Buffer days that can be used if needed without affecting the schedule. Shown as +N badge on end date.';
