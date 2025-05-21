-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create function to check if extension exists
CREATE OR REPLACE FUNCTION create_vector_extension()
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
  ) THEN
    CREATE EXTENSION vector;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create vector similarity search function
CREATE OR REPLACE FUNCTION create_vector_search_function()
RETURNS VOID AS $$
BEGIN
  -- Drop function if exists
  DROP FUNCTION IF EXISTS match_reciters(vector, real, int);
  
  -- Create vector matching function using cosine distance
  CREATE FUNCTION match_reciters(
    query_embedding vector,
    match_threshold real,
    match_count int
  )
  RETURNS TABLE (
    id uuid,
    name text,
    style text,
    sample_audio_url text,
    feature_vector vector,
    similarity real
  )
  LANGUAGE plpgsql
  AS $$
  BEGIN
    RETURN QUERY
    SELECT
      r.id,
      r.name,
      r.style,
      r.sample_audio_url,
      r.feature_vector,
      1 - (r.feature_vector <=> query_embedding) AS similarity
    FROM reciters r
    WHERE 1 - (r.feature_vector <=> query_embedding) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
  END;
  $$;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create HNSW index creation function
CREATE OR REPLACE FUNCTION create_hnsw_index(
  m_param int,
  ef_construction_param int
)
RETURNS VOID AS $$
BEGIN
  -- Drop existing index if it exists
  DROP INDEX IF EXISTS reciters_feature_vector_idx;
  
  -- Create HNSW index with optimized parameters
  CREATE INDEX reciters_feature_vector_idx ON reciters 
  USING hnsw (feature_vector vector_cosine_ops)
  WITH (m = m_param, ef_construction = ef_construction_param);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if vector setup is complete
CREATE OR REPLACE FUNCTION check_vector_setup()
RETURNS boolean AS $$
DECLARE
  function_exists boolean;
  index_exists boolean;
BEGIN
  -- Check if function exists
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'match_reciters'
  ) INTO function_exists;
  
  -- Check if index exists
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'reciters_feature_vector_idx'
  ) INTO index_exists;
  
  -- Return true if both function and index exist
  RETURN function_exists AND index_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Alter reciters table to use vector type if needed
DO $$
BEGIN
  -- Check if column exists and is not vector type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reciters'
    AND column_name = 'feature_vector'
    AND data_type != 'USER-DEFINED'
  ) THEN
    -- Change column type to vector with dimension 1536
    ALTER TABLE reciters
    ALTER COLUMN feature_vector TYPE vector(1536);
  END IF;
  
  -- If feature_vector column doesn't exist, add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reciters'
    AND column_name = 'feature_vector'
  ) THEN
    ALTER TABLE reciters
    ADD COLUMN feature_vector vector(1536);
  END IF;
END;
$$; 