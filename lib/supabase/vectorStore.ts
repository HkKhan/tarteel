/**
 * Vector Store Module
 * Implements pgvector integration with Supabase:
 * - Vector storage and retrieval
 * - HNSW indexing configuration
 * - Similarity search
 */

import { createClient } from './server';
import AudioConfig from '@/config/audio';

// Type definition for vector search results
type VectorSearchResult = {
  id: string;
  name: string;
  style: string;
  sample_audio_url?: string;
  feature_vector: number[];
  similarity: number;
};

/**
 * Store a feature vector for a reciter
 * @param reciterId ID of the reciter
 * @param featureVector Feature vector to store
 * @returns Success status
 */
export async function storeFeatureVector(
  reciterId: string,
  featureVector: number[]
): Promise<boolean> {
  try {
    const supabase = createClient();
    
    // Ensure vector has correct dimension
    const targetDimension = AudioConfig.vector.finalDimension;
    let vectorToStore = featureVector;
    
    if (featureVector.length !== targetDimension) {
      console.warn(`Vector dimension mismatch: got ${featureVector.length}, expected ${targetDimension}. Adjusting...`);
      
      if (featureVector.length < targetDimension) {
        // Pad with zeros if too short
        vectorToStore = [...featureVector, ...new Array(targetDimension - featureVector.length).fill(0)];
      } else {
        // Truncate if too long
        vectorToStore = featureVector.slice(0, targetDimension);
      }
    }
    
    // Update the reciter in the database
    const { error } = await supabase
      .from('reciters')
      .update({ feature_vector: vectorToStore })
      .eq('id', reciterId);
    
    if (error) {
      console.error('Error storing feature vector:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Exception storing feature vector:', error);
    return false;
  }
}

/**
 * Find similar reciters based on vector embedding
 * @param queryVector Query vector to search with
 * @param limit Maximum number of results to return
 * @param matchThreshold Minimum similarity threshold (0-1)
 * @returns Array of matching reciters with similarity scores
 */
export async function findSimilarReciters(
  queryVector: number[],
  limit: number = 5,
  matchThreshold: number = 0.7
): Promise<VectorSearchResult[]> {
  try {
    const supabase = createClient();
    
    // Ensure vector has correct dimension
    const targetDimension = AudioConfig.vector.finalDimension;
    let vectorToQuery = queryVector;
    
    if (queryVector.length !== targetDimension) {
      console.warn(`Query vector dimension mismatch: got ${queryVector.length}, expected ${targetDimension}. Adjusting...`);
      
      if (queryVector.length < targetDimension) {
        // Pad with zeros if too short
        vectorToQuery = [...queryVector, ...new Array(targetDimension - queryVector.length).fill(0)];
      } else {
        // Truncate if too long
        vectorToQuery = queryVector.slice(0, targetDimension);
      }
    }
    
    // Perform vector similarity search
    const { data, error } = await supabase
      .rpc('match_reciters', {
        query_embedding: vectorToQuery,
        match_threshold: matchThreshold,
        match_count: limit
      });
    
    if (error) {
      console.error('Error performing vector search:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Exception performing vector search:', error);
    return [];
  }
}

/**
 * Get a reciter's feature vector
 * @param reciterId ID of the reciter
 * @returns Feature vector or null if not found
 */
export async function getReciterVector(reciterId: string): Promise<number[] | null> {
  try {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('reciters')
      .select('feature_vector')
      .eq('id', reciterId)
      .single();
    
    if (error || !data) {
      console.error('Error getting reciter vector:', error);
      return null;
    }
    
    return data.feature_vector;
  } catch (error) {
    console.error('Exception getting reciter vector:', error);
    return null;
  }
}

/**
 * Create SQL function for vector similarity search
 * This should be run during database initialization
 */
export async function setupVectorSearchFunction(): Promise<boolean> {
  try {
    const supabase = createClient();
    
    // Create pgvector extension if it doesn't exist
    const { error: extensionError } = await supabase.rpc('create_vector_extension');
    
    if (extensionError) {
      console.error('Error creating pgvector extension:', extensionError);
      // Continue anyway as it might already exist
    }
    
    // Create the vector search function
    const { error } = await supabase.rpc('create_vector_search_function');
    
    if (error) {
      console.error('Error creating vector search function:', error);
      return false;
    }
    
    // Create HNSW index with optimal parameters
    const { error: indexError } = await supabase.rpc('create_hnsw_index', {
      m_param: 16,
      ef_construction_param: 64
    });
    
    if (indexError) {
      console.error('Error creating HNSW index:', indexError);
      // Continue as index might already exist
    }
    
    return true;
  } catch (error) {
    console.error('Exception setting up vector search:', error);
    return false;
  }
}

/**
 * Check if the vector setup is complete
 */
export async function checkVectorSetup(): Promise<boolean> {
  try {
    const supabase = createClient();
    
    // Check if vector search function exists
    const { data, error } = await supabase.rpc('check_vector_setup');
    
    if (error) {
      console.error('Error checking vector setup:', error);
      return false;
    }
    
    return data || false;
  } catch (error) {
    console.error('Exception checking vector setup:', error);
    return false;
  }
} 