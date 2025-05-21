import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Match a user's recitation against known reciters using enhanced audio fingerprinting.
 * Uses the two-stage matching process:
 * 1. First stage: Fast vector comparison
 * 2. Second stage: Detailed DTW comparison for top matches
 * 
 * @param {Object} userFeatures - The extracted features from user's recitation
 * @param {number} limit - Maximum number of results to return (default: 3)
 * @param {number} minScore - Minimum similarity score to consider a match (default: 0.5)
 * @returns {Promise<Array>} - Array of matched reciters with similarity scores
 */
export async function matchReciter(userFeatures, limit = 3, minScore = 0.5) {
  try {
    // Get all reciters from the database
    const { data: reciters, error } = await supabase
      .from('reciters')
      .select('id, name, style, feature_vector');

    if (error) {
      console.error('Error fetching reciters:', error);
      return [];
    }

    // Array to store similarity scores
    const matches = [];

    // Stage 1: First pass with fast vector comparison
    for (const reciter of reciters) {
      if (!reciter.feature_vector || !reciter.feature_vector.feature_vector) {
        continue; // Skip reciters without feature vectors
      }

      // Fast vector comparison
      const reciterVector = reciter.feature_vector.feature_vector;
      const userVector = userFeatures.feature_vector;
      
      // Calculate cosine similarity
      const similarity = calculateCosineSimilarity(userVector, reciterVector);
      
      // If similarity is above threshold, add to potential matches
      if (similarity >= minScore * 0.8) { // Lower threshold for first stage
        matches.push({
          reciterId: reciter.id,
          reciterName: reciter.name,
          style: reciter.style,
          similarity: similarity,
          fullFeatures: reciter.feature_vector,
          stage: 1
        });
      }
    }

    // Sort matches by similarity score (descending)
    matches.sort((a, b) => b.similarity - a.similarity);
    
    // Stage 2: Take top N matches and perform detailed comparison
    const topMatches = matches.slice(0, Math.min(matches.length, limit * 2));
    
    for (let i = 0; i < topMatches.length; i++) {
      const match = topMatches[i];
      
      // Skip detailed comparison if no sequence features available
      if (!match.fullFeatures.sequence_features || 
          !userFeatures.sequence_features) {
        continue;
      }
      
      // Perform detailed comparison using two-stage matcher
      const detailedSimilarity = await performDetailedMatching(
        userFeatures,
        match.fullFeatures
      );
      
      // Update the similarity score with the detailed one
      topMatches[i].similarity = detailedSimilarity.similarity;
      topMatches[i].stage = detailedSimilarity.stage;
      topMatches[i].matchDetails = detailedSimilarity;
    }
    
    // Re-sort after detailed comparison
    topMatches.sort((a, b) => b.similarity - a.similarity);
    
    // Return top matches up to limit
    return topMatches.slice(0, limit);
    
  } catch (error) {
    console.error('Error in matchReciter:', error);
    return [];
  }
}

/**
 * Calculate cosine similarity between two vectors
 * 
 * @param {Array} vector1 - First feature vector
 * @param {Array} vector2 - Second feature vector
 * @returns {number} - Cosine similarity score (0-1)
 */
function calculateCosineSimilarity(vector1, vector2) {
  if (!vector1 || !vector2 || vector1.length !== vector2.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  for (let i = 0; i < vector1.length; i++) {
    dotProduct += vector1[i] * vector2[i];
    magnitude1 += vector1[i] * vector1[i];
    magnitude2 += vector2[i] * vector2[i];
  }
  
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }
  
  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Perform detailed matching using sequences and segments
 * This function simulates the Python two_stage_matcher functionality
 * 
 * @param {Object} userFeatures - User's audio features
 * @param {Object} reciterFeatures - Reciter's audio features
 * @returns {Object} - Detailed similarity results
 */
async function performDetailedMatching(userFeatures, reciterFeatures) {
  // Simulate the Python-based matching by calling our API endpoint
  try {
    const response = await fetch('/api/audio/match-detailed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userFeatures,
        reciterFeatures
      }),
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error in detailed matching:', error);
    
    // Fallback to basic cosine similarity if API call fails
    const cosine = calculateCosineSimilarity(
      userFeatures.feature_vector, 
      reciterFeatures.feature_vector
    );
    
    return {
      similarity: cosine,
      method: 'cosine_fallback',
      stage: 1
    };
  }
}

/**
 * Store a new reciter in the database with enhanced audio fingerprinting features
 * 
 * @param {string} name - Reciter name
 * @param {string} style - Recitation style (Hafs, Warsh, etc)
 * @param {Object} features - Enhanced audio features
 * @returns {Promise<Object>} - Created reciter record
 */
export async function storeReciterFeatures(name, style, features) {
  try {
    const { data, error } = await supabase
      .from('reciters')
      .insert([
        { 
          name, 
          style,
          feature_vector: features
        }
      ])
      .select();
    
    if (error) {
      console.error('Error storing reciter:', error);
      throw error;
    }
    
    return data[0];
  } catch (error) {
    console.error('Error in storeReciterFeatures:', error);
    throw error;
  }
} 