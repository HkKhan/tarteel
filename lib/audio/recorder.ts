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

export async function submitRecording(audioBlob: Blob, userId: string = "guest"): Promise<string> {
  const base64 = await blobToBase64(audioBlob);
  const cloudRunUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!cloudRunUrl) throw new Error("Missing NEXT_PUBLIC_API_URL in environment");
  
  const res = await fetch(`${cloudRunUrl}/submit-recording`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audio_data: base64, user_id: userId }),
  });
  if (!res.ok) throw new Error("Submit failed");
  const { job_id } = await res.json();
  return job_id;
}

export async function pollJobStatus(
  jobId: string,
  onStatusChange: (status: string) => void,
  intervalMs = 3000,
  timeoutMs = 300_000
): Promise<any> {
  const cloudRunUrl = process.env.NEXT_PUBLIC_API_URL;
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(async () => {
      if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error("Timed out waiting for result"));
        return;
      }
      try {
        const res = await fetch(`${cloudRunUrl}/job-status/${jobId}`);
        const data = await res.json();
        onStatusChange(data.status);
        if (data.status === "done") {
          clearInterval(interval);
          resolve(formatBackendResult(data.result));
        } else if (data.status === "error") {
          clearInterval(interval);
          reject(new Error(data.error || "Processing failed"));
        }
      } catch (e) {
        // network blip — keep polling
      }
    }, intervalMs);
  });
}

function formatBackendResult(data: any) {
  const mappedPredictions = data.rankings.map((r: any) => ({
    speaker: r.name,
    confidence: r.score
  }));
  
  const matchResults = mappedPredictions.map((prediction: any, index: number) => ({
    reciterId: `prediction_${index}`,
    reciterName: prediction.speaker,
    recitationStyle: prediction.speaker,
    similarityScore: prediction.confidence * 100, // Convert to percentage
    aspectScores: transformAspectScores({
      intonation: prediction.confidence * 0.95,
      pace: prediction.confidence * 0.92,
      melody: prediction.confidence * 0.88,
      strength: prediction.confidence * 0.90,
      articulation: prediction.confidence * 0.94,
      fluency: prediction.confidence * 0.89,
      rhythm: prediction.confidence * 0.91
    })
  }));
  
  matchResults.sort((a: any, b: any) => b.similarityScore - a.similarityScore);
  const bestMatch = matchResults.length > 0 ? matchResults[0] : null;
  
  const generalFeedback = bestMatch ? [
    `Your recitation most closely matches ${bestMatch.reciterName} (${Math.round(bestMatch.similarityScore)}% match)`,
    `You excel in ${findStrongestAspect(bestMatch.aspectScores)}`,
    `For improvement, focus on your ${findWeakestAspect(bestMatch.aspectScores)}`
  ] : [];
  
  return {
    bestMatch,
    matchResults,
    generalFeedback,
    featureInfo: data.feature_info,
    wordFeedback: data.word_feedback || [],
    refAudioUrl: data.ref_audio_url || null
  };
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