-- Function to get column names for a table
CREATE OR REPLACE FUNCTION debug_table_schema(table_name text)
RETURNS text[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT column_name::text
    FROM information_schema.columns
    WHERE table_name = $1
    AND table_schema = 'public'
    ORDER BY ordinal_position
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 