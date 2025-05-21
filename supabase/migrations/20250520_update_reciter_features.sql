-- Migration to update the reciters table to support enhanced audio fingerprinting
-- No need to change the table structure as feature_vector is already JSON

-- Add a comment to the feature_vector column to document the expected structure
COMMENT ON COLUMN public.reciters.feature_vector IS 
'JSON structure containing:
- feature_vector: Basic vector for first-stage matching
- sequence_features: Sequential features for DTW
- segments: Audio segments (verses/ayat)
- pitch_contour: Pitch tracking data
- formants: Voice characteristics data
- pause_patterns: Pause timing data
- feature_shapes: Dimensions of various features';

-- Create a function to help migrating existing data
CREATE OR REPLACE FUNCTION migrate_reciter_feature_vectors()
RETURNS void AS $$
DECLARE
    reciter_record RECORD;
    old_vector JSONB;
    new_format JSONB;
BEGIN
    FOR reciter_record IN SELECT id, feature_vector FROM public.reciters
    LOOP
        -- Skip null feature vectors
        IF reciter_record.feature_vector IS NULL THEN
            CONTINUE;
        END IF;
        
        old_vector := reciter_record.feature_vector::jsonb;
        
        -- Check if it's already in the new format
        IF jsonb_typeof(old_vector) = 'object' AND 
           old_vector ? 'feature_vector' THEN
            -- Already migrated, skip
            CONTINUE;
        END IF;
        
        -- For old format (just an array), convert to new structure
        IF jsonb_typeof(old_vector) = 'array' THEN
            new_format := jsonb_build_object(
                'feature_vector', old_vector,
                'sequence_features', jsonb_build_array(),  -- Empty array for now
                'segments', jsonb_build_array(),  -- Empty array for now
                'pitch_contour', jsonb_build_array(),  -- Empty array for now
                'formants', jsonb_build_array(),  -- Empty array for now
                'pause_patterns', jsonb_build_array(),  -- Empty array for now
                'feature_shapes', jsonb_build_object(
                    'vector_dimension', jsonb_array_length(old_vector)
                )
            );
            
            -- Update the record
            UPDATE public.reciters
            SET feature_vector = new_format
            WHERE id = reciter_record.id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the migration function
SELECT migrate_reciter_feature_vectors();

-- Drop the function after use
DROP FUNCTION IF EXISTS migrate_reciter_feature_vectors();

-- Create an index on the feature_vector to improve performance of similarity searches
CREATE INDEX IF NOT EXISTS idx_reciters_feature_vector_gin 
ON public.reciters USING GIN ((feature_vector -> 'feature_vector')); 