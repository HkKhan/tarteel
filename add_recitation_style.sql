-- Migration: Add recitation_style column to reciters table

-- First, check if the column exists before trying to add it
DO $$
BEGIN
    -- Add recitation_style column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'reciters' 
        AND column_name = 'recitation_style'
    ) THEN
        ALTER TABLE reciters ADD COLUMN recitation_style TEXT;
    END IF;
END $$;

-- Update existing reciters based on their names
UPDATE reciters
SET recitation_style = 
    CASE 
        WHEN name ILIKE '%warsh%' THEN 'Warsh'
        ELSE 'Hafs'
    END
WHERE recitation_style IS NULL;

-- Update TypeScript types
-- After running this migration, update lib/database.types.ts to include:
-- reciters: {
--   Row: {
--     ...existing fields...
--     recitation_style: string | null
--   }
--   Insert: {
--     ...existing fields...
--     recitation_style?: string | null
--   }
--   Update: {
--     ...existing fields...
--     recitation_style?: string | null
--   }
-- } 