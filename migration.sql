-- Migration: Add missing columns to reciters table
-- Adds both feature_vector and profile_image_url columns

-- First, check if the columns exist before trying to add them
DO $$
BEGIN
    -- Add profile_image_url column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'reciters' 
        AND column_name = 'profile_image_url'
    ) THEN
        ALTER TABLE reciters ADD COLUMN profile_image_url TEXT;
    END IF;

    -- Add feature_vector column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'reciters' 
        AND column_name = 'feature_vector'
    ) THEN
        ALTER TABLE reciters ADD COLUMN feature_vector JSONB;
    END IF;
END $$;

-- Update TypeScript types
-- After running this migration, update lib/database.types.ts to include:
-- reciters: {
--   Row: {
--     ...existing fields...
--     profile_image_url: string | null
--     feature_vector: Json | null
--   }
--   Insert: {
--     ...existing fields...
--     profile_image_url?: string | null
--     feature_vector?: Json | null
--   }
--   Update: {
--     ...existing fields...
--     profile_image_url?: string | null
--     feature_vector?: Json | null
--   }
-- } 