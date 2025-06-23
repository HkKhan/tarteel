/**
 * Audio recording utilities for the Tarteel app
 * Uses the Python-based API endpoint for processing
 */

/**
 * Convert a Blob to a base64 encoded string
 */
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Process recorded audio for reciter matching
 * @param audioBlob The recorded audio or uploaded file as a Blob
 * @returns Matching results from the API
 */
export async function processRecitation(audioBlob: Blob) {
  try {
    // Convert the blob to base64
    const audioBase64 = await blobToBase64(audioBlob);
    
    // Get audio type from the blob
    // Default to audio/mpeg for recorded audio
    const audioType = audioBlob.type || 'audio/mpeg';
    
    // Send to the Python API endpoint
    const response = await fetch('/api/process-recitation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio: audioBase64,
        audioType: audioType
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }
    
    // Parse the response
    const data = await response.json();
    
    // Transform the data to match the expected format in the frontend
    const matchResults = data.matches.map((match: any) => ({
      reciterId: match.id,
      reciterName: match.name,
      recitationStyle: match.style,
      similarityScore: match.similarity_score * 100, // Convert to percentage
      aspectScores: transformAspectScores(match.aspect_scores || {})
    }));
    
    // Sort by similarity score
    matchResults.sort((a: any, b: any) => b.similarityScore - a.similarityScore);
    
    // Get the best match
    const bestMatch = matchResults.length > 0 ? matchResults[0] : null;
    
    // Generate feedback
    const generalFeedback = bestMatch ? [
      `Your recitation most closely matches ${bestMatch.reciterName} (${Math.round(bestMatch.similarityScore)}% match)`,
      `You excel in ${findStrongestAspect(bestMatch.aspectScores)}`,
      `For improvement, focus on your ${findWeakestAspect(bestMatch.aspectScores)}`
    ] : [];
    
    return {
      bestMatch,
      matchResults,
      generalFeedback,
      featureInfo: data.feature_info
    };
  } catch (error) {
    console.error('Error processing recitation:', error);
    throw error;
  }
}

/**
 * Register a new reciter with the Python API
 * @param audioFile The audio file (Blob or File)
 * @param reciterName The name of the reciter
 * @returns Registration results from the API
 */
export async function registerReciter(audioFile: Blob | File, reciterName: string) {
  try {
    // Convert the blob to base64
    const audioBase64 = await blobToBase64(audioFile);
    
    // Get audio type from the file
    const audioType = audioFile.type || 'audio/mpeg';
    
    // Send to the API endpoint
    const formData = new FormData();
    formData.append('name', reciterName);
    formData.append('audio', audioFile);
    
    const response = await fetch('/api/new-reciter', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }
    
    // Parse and return the response
    return await response.json();
  } catch (error) {
    console.error('Error registering reciter:', error);
    throw error;
  }
}

/**
 * Transform aspect scores from the API format to the frontend format
 */
function transformAspectScores(scores: Record<string, number>): Record<string, number> {
  // Default set of aspects if they're not provided by the API
  const defaultAspects = [
    'intonation',
    'pace',
    'melody',
    'strength',
    'articulation',
    'fluency',
    'rhythm'
  ];
  
  // If no scores are provided, return default scores
  if (Object.keys(scores).length === 0) {
    return defaultAspects.reduce((acc, aspect) => {
      acc[aspect] = 0.7; // Default score
      return acc;
    }, {} as Record<string, number>);
  }
  
  // Normalize scores to be between 0 and 1
  const result: Record<string, number> = {};
  for (const aspect in scores) {
    result[aspect] = scores[aspect]; // Assuming the Python API returns scores in the 0-1 range
  }
  
  return result;
}

/**
 * Find the strongest aspect based on aspect scores
 */
function findStrongestAspect(aspectScores: Record<string, number>): string {
  let maxScore = -1;
  let strongestAspect = "";
  
  for (const aspect in aspectScores) {
    if (aspectScores[aspect] > maxScore) {
      maxScore = aspectScores[aspect];
      strongestAspect = aspect;
    }
  }
  
  return strongestAspect || 'rhythm'; // Default value if none found
}

/**
 * Find the weakest aspect based on aspect scores
 */
function findWeakestAspect(aspectScores: Record<string, number>): string {
  let minScore = Infinity;
  let weakestAspect = "";
  
  for (const aspect in aspectScores) {
    if (aspectScores[aspect] < minScore) {
      minScore = aspectScores[aspect];
      weakestAspect = aspect;
    }
  }
  
  return weakestAspect || 'articulation'; // Default value if none found
} 