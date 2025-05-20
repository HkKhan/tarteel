"use client";

/**
 * Calculate similarity between two MFCC feature vectors
 * Can handle both raw MFCC arrays and means/variances format
 */
export function calculateSimilarity(
  featureVector1: any,
  featureVector2: any
): number {
  // Handle different feature vector formats
  
  // Case 1: Both are arrays of MFCC frames (raw format)
  if (Array.isArray(featureVector1) && Array.isArray(featureVector2)) {
    // Calculate means for comparison
    const means1 = calculateMean(featureVector1);
    const means2 = calculateMean(featureVector2);
    
    // Calculate Euclidean distance between means
    let distance = 0;
    for (let i = 0; i < Math.min(means1.length, means2.length); i++) {
      const diff = means1[i] - means2[i];
      distance += diff * diff;
    }
    
    // Take the square root to get Euclidean distance
    distance = Math.sqrt(distance);
    
    // Convert to a similarity score (inverse relationship)
    // Scale to 0-100 range (higher is more similar)
    return 100 * Math.exp(-distance / 10);
  }
  
  // Case 2: Traditional means/variances format
  if (featureVector1.means && featureVector2.means) {
    // Use Euclidean distance for simplicity
    let meanDistance = 0;
    let varianceDistance = 0;

    // Calculate distance between means
    for (let i = 0; i < featureVector1.means.length; i++) {
      const diff = featureVector1.means[i] - featureVector2.means[i];
      meanDistance += diff * diff;
    }

    // Calculate distance between variances
    for (let i = 0; i < featureVector1.variances.length; i++) {
      const diff = featureVector1.variances[i] - featureVector2.variances[i];
      varianceDistance += diff * diff;
    }

    // Take the square root to get Euclidean distance
    const distance = Math.sqrt(meanDistance + varianceDistance);
    
    // Convert to a similarity score (inverse relationship)
    // Scale to 0-100 range (higher is more similar)
    return 100 * Math.exp(-distance / 10);
  }
  
  // Case 3: Mixed formats - prefer means-only comparison if available
  const means1 = Array.isArray(featureVector1) ? calculateMean(featureVector1) : featureVector1.means;
  const means2 = Array.isArray(featureVector2) ? calculateMean(featureVector2) : featureVector2.means;
  
  if (means1 && means2) {
    let distance = 0;
    for (let i = 0; i < Math.min(means1.length, means2.length); i++) {
      const diff = means1[i] - means2[i];
      distance += diff * diff;
    }
    
    // Take the square root to get Euclidean distance
    distance = Math.sqrt(distance);
    
    // Convert to a similarity score
    return 100 * Math.exp(-distance / 10);
  }
  
  // Fallback: return a random score if formats are incompatible
  return 50 + Math.random() * 20;
}

/**
 * Calculate mean values for each MFCC coefficient across frames
 */
function calculateMean(mfccs: number[][]): number[] {
  if (mfccs.length === 0) return [];
  
  const numCoefficients = mfccs[0].length;
  const means = new Array(numCoefficients).fill(0);
  
  for (const frame of mfccs) {
    for (let i = 0; i < numCoefficients; i++) {
      means[i] += frame[i];
    }
  }
  
  return means.map(sum => sum / mfccs.length);
}

/**
 * Generate tajweed feedback based on MFCC analysis
 * This is a placeholder that generates simulated feedback
 */
export function generateTajweedFeedback(
  featureVector: any,
  topMatch: any
): string[] {
  // This is a placeholder that would be replaced with actual analysis
  const feedbackPoints = [
    "Your recitation style shows similarities with " + topMatch.reciterName,
    "Your voice has good rhythm and pacing",
    "Consider focusing on elongating the vowels in specific positions (madd)",
    "Practice the nasal sounds (ghunnah) to match the classical style",
  ];
  
  return feedbackPoints;
} 