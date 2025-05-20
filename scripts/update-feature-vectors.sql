-- SQL script to update all reciter feature vectors with MFCC-compatible format
-- Run this in the Supabase SQL Editor

-- First, check if we need to update any reciters
DO $$
DECLARE
  reciter_count INT;
BEGIN
  -- Count reciters with feature vectors
  SELECT COUNT(*) INTO reciter_count FROM reciters 
  WHERE feature_vector IS NOT NULL;
  
  -- Output to console
  RAISE NOTICE 'Found % reciters with feature vectors', reciter_count;
END $$;

-- Create a function to generate mock MFCC coefficients
CREATE OR REPLACE FUNCTION generate_mfcc_features()
RETURNS jsonb AS $$
DECLARE
  num_coefficients INT := 13;
  means jsonb;
  mfccs jsonb;
  frame_count INT := 10;
  i INT;
  frame jsonb;
BEGIN
  -- Generate mock means (will use existing means if available)
  means := jsonb_build_array();
  FOR i IN 1..num_coefficients LOOP
    means := means || (random() * 2 - 1);
  END LOOP;
  
  -- Generate mock mfccs frames
  mfccs := jsonb_build_array();
  FOR i IN 1..frame_count LOOP
    frame := jsonb_build_array();
    FOR j IN 1..num_coefficients LOOP
      frame := frame || (random() * 2 - 1);
    END LOOP;
    mfccs := mfccs || frame;
  END LOOP;
  
  -- Return the full feature structure
  RETURN jsonb_build_object(
    'mfccs', mfccs,
    'mfccMeans', means,
    'mfccStdDevs', means, -- Just use the same values for simplicity
    'sampleRate', 44100,
    'frameSize', 1024,
    'hopSize', 512,
    'frameCount', frame_count,
    'metadata', jsonb_build_object(
      'coefficientCount', num_coefficients,
      'duration', 3.0,
      'extractionMethod', 'mock'
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Update existing reciters to have both the old format (means, variances) and new format (fullFeatures)
UPDATE reciters 
SET feature_vector = jsonb_build_object(
  'means', 
    CASE 
      WHEN feature_vector->>'means' IS NOT NULL THEN feature_vector->'means'
      ELSE jsonb_build_array(0.2, -0.3, 0.15, -0.1, 0.4, 0.1, -0.2, 0.1, 0.3, -0.1, 0.2, -0.3, 0.1)
    END,
  'variances', 
    CASE 
      WHEN feature_vector->>'variances' IS NOT NULL THEN feature_vector->'variances' 
      ELSE jsonb_build_array(0.05, 0.1, 0.08, 0.07, 0.12, 0.05, 0.09, 0.07, 0.11, 0.06, 0.08, 0.1, 0.07)
    END,
  'fullFeatures', generate_mfcc_features()
)
WHERE feature_vector IS NOT NULL;

-- Update reciters without feature vectors
UPDATE reciters
SET feature_vector = jsonb_build_object(
  'means', jsonb_build_array(0.2, -0.3, 0.15, -0.1, 0.4, 0.1, -0.2, 0.1, 0.3, -0.1, 0.2, -0.3, 0.1),
  'variances', jsonb_build_array(0.05, 0.1, 0.08, 0.07, 0.12, 0.05, 0.09, 0.07, 0.11, 0.06, 0.08, 0.1, 0.07),
  'fullFeatures', generate_mfcc_features()
)
WHERE feature_vector IS NULL;

-- Verify the update
SELECT id, name, 
  jsonb_array_length(feature_vector->'means') as means_length,
  jsonb_array_length(feature_vector->'variances') as variances_length,
  feature_vector->'fullFeatures'->>'extractionMethod' as extraction_method
FROM reciters
LIMIT 5;

-- Clean up
DROP FUNCTION IF EXISTS generate_mfcc_features(); 