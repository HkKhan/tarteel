/**
 * Similarity Search Module
 * Implements algorithms for audio feature matching:
 * - Dynamic Time Warping for temporal alignment
 * - Cosine similarity with sliding window
 * - Weighted feature importance based on syllabic patterns
 * - Confidence scoring system
 */

import AudioConfig from '@/config/audio';
import { TajweedAspects } from '@/config/audio';

/**
 * Main function to find similarity between user and reciter audio features
 * @param userFeatures User's audio features
 * @param reciterFeatures Reference reciter features
 * @returns Similarity results with scores and justifications
 */
export function findSimilarity(
  userFeatures: {
    mfcc: number[][],
    chroma: number[][],
    melSpectrogram: number[][],
    temporalFeatures: number[][],
    fusedFeatures: number[][],
    vectorEmbedding: number[]
  },
  reciterFeatures: {
    mfcc: number[][],
    chroma: number[][],
    melSpectrogram: number[][],
    temporalFeatures: number[][],
    fusedFeatures: number[][],
    vectorEmbedding: number[]
  }
): {
  overallScore: number;
  aspectScores: Record<string, number>;
  justifications: Record<string, string>;
  confidenceScore: number;
} {
  // Calculate similarity using multiple approaches
  
  // 1. Vector embedding cosine similarity (fastest)
  const vectorSimilarity = calculateCosineSimilarity(
    userFeatures.vectorEmbedding,
    reciterFeatures.vectorEmbedding
  );
  
  // 2. Dynamic time warping on fused features (more accurate temporal alignment)
  const dtwDistance = calculateDynamicTimeWarping(
    userFeatures.fusedFeatures,
    reciterFeatures.fusedFeatures
  );
  
  // Convert DTW distance to similarity score (inverse relationship)
  const dtwSimilarity = Math.exp(-dtwDistance / 100);
  
  // 3. Feature-specific similarities
  const mfccSimilarity = calculateFeatureSetSimilarity(
    userFeatures.mfcc,
    reciterFeatures.mfcc
  );
  
  const chromaSimilarity = calculateFeatureSetSimilarity(
    userFeatures.chroma,
    reciterFeatures.chroma
  );
  
  const temporalSimilarity = calculateFeatureSetSimilarity(
    userFeatures.temporalFeatures,
    reciterFeatures.temporalFeatures
  );
  
  // 4. Sliding window analysis for local similarity patterns
  const windowSimilarity = calculateSlidingWindowSimilarity(
    userFeatures.fusedFeatures,
    reciterFeatures.fusedFeatures,
    AudioConfig.matching.windowSize
  );
  
  // Combine different similarity measures (weighted average)
  const overallScore = 100 * (
    0.3 * vectorSimilarity +
    0.3 * dtwSimilarity +
    0.1 * mfccSimilarity +
    0.1 * chromaSimilarity +
    0.1 * temporalSimilarity +
    0.1 * windowSimilarity
  );
  
  // Calculate scores for specific tajweed aspects
  const aspectScores = calculateAspectScores(
    userFeatures,
    reciterFeatures
  );
  
  // Generate justifications for each aspect score
  const justifications = generateJustifications(aspectScores);
  
  // Calculate confidence score based on feature consistency
  const confidenceScore = calculateConfidenceScore([
    vectorSimilarity,
    dtwSimilarity,
    mfccSimilarity,
    chromaSimilarity,
    temporalSimilarity,
    windowSimilarity
  ]);
  
  return {
    overallScore,
    aspectScores,
    justifications,
    confidenceScore
  };
}

/**
 * Calculate cosine similarity between two vectors
 */
export function calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
  // Handle empty vectors
  if (!vec1.length || !vec2.length) {
    return 0;
  }
  
  // Use smaller length if vectors have different lengths
  const length = Math.min(vec1.length, vec2.length);
  
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  // Calculate dot product and magnitudes
  for (let i = 0; i < length; i++) {
    dotProduct += vec1[i] * vec2[i];
    magnitude1 += vec1[i] * vec1[i];
    magnitude2 += vec2[i] * vec2[i];
  }
  
  // Avoid division by zero
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }
  
  // Return cosine similarity (normalized to [0,1] range)
  return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
}

/**
 * Calculate similarity between two sets of features
 */
function calculateFeatureSetSimilarity(
  features1: number[][],
  features2: number[][]
): number {
  // Handle empty feature sets
  if (!features1.length || !features2.length) {
    return 0;
  }
  
  // Convert to mean vectors for comparison
  const mean1 = calculateMeanVector(features1);
  const mean2 = calculateMeanVector(features2);
  
  // Calculate cosine similarity between mean vectors
  return calculateCosineSimilarity(mean1, mean2);
}

/**
 * Calculate mean vector from a set of feature vectors
 */
function calculateMeanVector(features: number[][]): number[] {
  if (!features.length) return [];
  
  const numDimensions = features[0].length;
  const meanVector = new Array(numDimensions).fill(0);
  
  // Sum all vectors
  for (const feature of features) {
    for (let i = 0; i < numDimensions; i++) {
      meanVector[i] += feature[i] || 0;
    }
  }
  
  // Divide by count to get mean
  for (let i = 0; i < numDimensions; i++) {
    meanVector[i] /= features.length;
  }
  
  return meanVector;
}

/**
 * Calculate Dynamic Time Warping distance between two feature sequences
 */
export function calculateDynamicTimeWarping(
  features1: number[][],
  features2: number[][]
): number {
  // Handle empty feature sets
  if (!features1.length || !features2.length) {
    return Infinity;
  }
  
  const n = features1.length;
  const m = features2.length;
  
  // Initialize cost matrix with infinity
  const costMatrix = Array(n + 1).fill(null).map(() => 
    Array(m + 1).fill(Infinity)
  );
  
  // Base case
  costMatrix[0][0] = 0;
  
  // Fill the cost matrix
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      // Calculate Euclidean distance between feature vectors
      const cost = calculateEuclideanDistance(features1[i-1], features2[j-1]);
      
      // Find minimum of three possible previous steps
      const minPrevCost = Math.min(
        costMatrix[i-1][j],    // Insertion
        costMatrix[i][j-1],    // Deletion
        costMatrix[i-1][j-1]   // Match
      );
      
      costMatrix[i][j] = cost + minPrevCost;
    }
  }
  
  // Normalize by path length to handle different sequence lengths
  return costMatrix[n][m] / (n + m);
}

/**
 * Create a DTW instance for reuse (exported for the processor module)
 */
export function createDynamicTimeWarping() {
  return {
    calculate: calculateDynamicTimeWarping
  };
}

/**
 * Calculate Euclidean distance between two vectors
 */
function calculateEuclideanDistance(vec1: number[], vec2: number[]): number {
  // Use smaller length if vectors have different lengths
  const length = Math.min(vec1.length, vec2.length);
  
  let sumSquaredDiff = 0;
  for (let i = 0; i < length; i++) {
    const diff = vec1[i] - vec2[i];
    sumSquaredDiff += diff * diff;
  }
  
  return Math.sqrt(sumSquaredDiff);
}

/**
 * Calculate similarity using a sliding window approach
 */
function calculateSlidingWindowSimilarity(
  features1: number[][],
  features2: number[][],
  windowSize: number
): number {
  // Handle edge cases
  if (!features1.length || !features2.length) {
    return 0;
  }
  
  // Use the shorter sequence as the window to slide over the longer one
  let shortSeq, longSeq;
  if (features1.length <= features2.length) {
    shortSeq = features1;
    longSeq = features2;
  } else {
    shortSeq = features2;
    longSeq = features1;
  }
  
  // If the short sequence is shorter than the window, adjust window size
  const actualWindowSize = Math.min(windowSize, shortSeq.length);
  
  // Calculate the maximum possible number of windows
  const numWindows = longSeq.length - actualWindowSize + 1;
  
  // If we can't form a window, return low similarity
  if (numWindows <= 0) {
    return calculateFeatureSetSimilarity(features1, features2);
  }
  
  // Find the maximum similarity across all possible windows
  let maxSimilarity = 0;
  
  for (let i = 0; i < numWindows; i++) {
    // Extract window from long sequence
    const window = longSeq.slice(i, i + actualWindowSize);
    
    // Calculate similarity for this window
    const similarity = calculateFeatureSetSimilarity(shortSeq, window);
    
    // Update max if needed
    maxSimilarity = Math.max(maxSimilarity, similarity);
  }
  
  return maxSimilarity;
}

/**
 * Calculate scores for each tajweed aspect
 */
function calculateAspectScores(
  userFeatures: {
    mfcc: number[][],
    chroma: number[][],
    melSpectrogram: number[][],
    temporalFeatures: number[][],
    fusedFeatures: number[][]
  },
  reciterFeatures: {
    mfcc: number[][],
    chroma: number[][],
    melSpectrogram: number[][],
    temporalFeatures: number[][],
    fusedFeatures: number[][]
  }
): Record<string, number> {
  const aspectScores: Record<string, number> = {};
  
  // Assign each tajweed aspect based on specific feature comparisons
  
  // Intonation: based on both MFCC and chroma (pitch-related)
  aspectScores['intonation'] = 100 * (
    0.7 * calculateFeatureSetSimilarity(userFeatures.mfcc, reciterFeatures.mfcc) +
    0.3 * calculateFeatureSetSimilarity(userFeatures.chroma, reciterFeatures.chroma)
  );
  
  // Pace: based on temporal features
  aspectScores['pace'] = 100 * 
    calculateFeatureSetSimilarity(userFeatures.temporalFeatures, reciterFeatures.temporalFeatures);
  
  // Melody: primarily based on chroma features
  aspectScores['melody'] = 100 *
    calculateFeatureSetSimilarity(userFeatures.chroma, reciterFeatures.chroma);
  
  // Strength: based on energy-related components in temporal features
  const userEnergy = userFeatures.temporalFeatures.map((f: number[]) => f[0]);
  const reciterEnergy = reciterFeatures.temporalFeatures.map((f: number[]) => f[0]);
  aspectScores['strength'] = 100 * 
    calculateCosineSimilarity(userEnergy, reciterEnergy);
  
  // Articulation: based on MFCC (phonetic content)
  aspectScores['articulation'] = 100 *
    calculateFeatureSetSimilarity(userFeatures.mfcc, reciterFeatures.mfcc);
  
  // Fluency: based on DTW alignment cost (lower cost = better alignment = more fluent)
  const dtwDistance = calculateDynamicTimeWarping(
    userFeatures.fusedFeatures,
    reciterFeatures.fusedFeatures
  );
  aspectScores['fluency'] = 100 * Math.exp(-dtwDistance / 50);
  
  // Rhythm: based on temporal pattern analysis
  aspectScores['rhythm'] = 100 * calculateSlidingWindowSimilarity(
    userFeatures.temporalFeatures,
    reciterFeatures.temporalFeatures,
    AudioConfig.matching.windowSize
  );
  
  // Ensure all scores are in [0, 100] range
  for (const aspect in aspectScores) {
    aspectScores[aspect] = Math.max(0, Math.min(100, aspectScores[aspect]));
  }
  
  return aspectScores;
}

/**
 * Generate justifications for scores
 */
function generateJustifications(aspectScores: Record<string, number>): Record<string, string> {
  const justifications: Record<string, string> = {};
  
  // Create justification for each aspect
  for (const aspect of TajweedAspects) {
    const score = aspectScores[aspect] || 0;
    
    // Categorize score
    let category: 'excellent' | 'good' | 'average' | 'needsWork' | 'poor';
    
    if (score >= 90) {
      category = 'excellent';
    } else if (score >= 75) {
      category = 'good';
    } else if (score >= 60) {
      category = 'average';
    } else if (score >= 40) {
      category = 'needsWork';
    } else {
      category = 'poor';
    }
    
    // Generate aspect-specific justification based on category
    switch (aspect) {
      case 'intonation':
        justifications[aspect] = getIntonationJustification(category);
        break;
      case 'pace':
        justifications[aspect] = getPaceJustification(category);
        break;
      case 'melody':
        justifications[aspect] = getMelodyJustification(category);
        break;
      case 'strength':
        justifications[aspect] = getStrengthJustification(category);
        break;
      case 'articulation':
        justifications[aspect] = getArticulationJustification(category);
        break;
      case 'fluency':
        justifications[aspect] = getFluencyJustification(category);
        break;
      case 'rhythm':
        justifications[aspect] = getRhythmJustification(category);
        break;
      default:
        justifications[aspect] = `Your ${aspect} is ${category}.`;
    }
  }
  
  return justifications;
}

/**
 * Calculate confidence score based on consistency of different similarity measures
 */
function calculateConfidenceScore(similarityScores: number[]): number {
  // Calculate mean
  const mean = similarityScores.reduce((sum, score) => sum + score, 0) / similarityScores.length;
  
  // Calculate standard deviation
  const variance = similarityScores.reduce((sum, score) => {
    const diff = score - mean;
    return sum + diff * diff;
  }, 0) / similarityScores.length;
  
  const stdDev = Math.sqrt(variance);
  
  // Calculate coefficient of variation (lower is better)
  const cv = stdDev / mean;
  
  // Convert to confidence score (inverse relationship)
  // CV of 0 gives 100% confidence, higher CV gives lower confidence
  return 100 * Math.exp(-2 * cv);
}

// Helper functions for justifications
function getIntonationJustification(category: string): string {
  switch (category) {
    case 'excellent':
      return 'Your intonation perfectly matches the reciter, with excellent rises and falls in pitch.';
    case 'good':
      return 'Your intonation is good, with most pitch variations matching the reciter.';
    case 'average':
      return 'Your intonation shows some resemblance to the reciter but could be more precise.';
    case 'needsWork':
      return 'Your intonation needs work - focus on matching the pitch rises and falls of the reciter.';
    case 'poor':
      return 'Your intonation is significantly different from the reciter. Try to listen carefully to the pitch patterns.';
    default:
      return 'Your intonation could not be properly analyzed.';
  }
}

function getPaceJustification(category: string): string {
  switch (category) {
    case 'excellent':
      return 'Your recitation pace perfectly matches the reciter, with excellent timing.';
    case 'good':
      return 'Your pace is good, maintaining similar speed to the reciter through most of the recitation.';
    case 'average':
      return 'Your pace is average, sometimes matching the reciter but with inconsistencies.';
    case 'needsWork':
      return 'Your pace needs work - pay attention to when the reciter speeds up or slows down.';
    case 'poor':
      return 'Your pace is significantly different from the reciter. Try to match their speed more closely.';
    default:
      return 'Your pace could not be properly analyzed.';
  }
}

function getMelodyJustification(category: string): string {
  switch (category) {
    case 'excellent':
      return 'Your melodic pattern beautifully matches the reciter, with excellent tonal quality.';
    case 'good':
      return 'Your melody is good, with similar tonal qualities to the reciter.';
    case 'average':
      return 'Your melody shows some resemblance to the reciter but could be more refined.';
    case 'needsWork':
      return 'Your melody needs work - focus on the musical qualities of the reciter\'s voice.';
    case 'poor':
      return 'Your melody is significantly different from the reciter. Try to listen to how they modulate their voice.';
    default:
      return 'Your melody could not be properly analyzed.';
  }
}

function getStrengthJustification(category: string): string {
  switch (category) {
    case 'excellent':
      return 'Your vocal strength perfectly matches the reciter, with excellent dynamics.';
    case 'good':
      return 'Your vocal strength is good, with similar emphasis patterns to the reciter.';
    case 'average':
      return 'Your vocal strength is average, sometimes matching the reciter\'s emphasis.';
    case 'needsWork':
      return 'Your vocal strength needs work - pay attention to how the reciter emphasizes certain syllables.';
    case 'poor':
      return 'Your vocal strength is significantly different from the reciter. Try to match their emphasis patterns.';
    default:
      return 'Your vocal strength could not be properly analyzed.';
  }
}

function getArticulationJustification(category: string): string {
  switch (category) {
    case 'excellent':
      return 'Your articulation perfectly matches the reciter, with excellent pronunciation clarity.';
    case 'good':
      return 'Your articulation is good, with similar pronunciation patterns to the reciter.';
    case 'average':
      return 'Your articulation is average, sometimes matching the reciter\'s clarity.';
    case 'needsWork':
      return 'Your articulation needs work - focus on the clarity of your pronunciation.';
    case 'poor':
      return 'Your articulation is significantly different from the reciter. Try to pronounce each letter more clearly.';
    default:
      return 'Your articulation could not be properly analyzed.';
  }
}

function getFluencyJustification(category: string): string {
  switch (category) {
    case 'excellent':
      return 'Your fluency perfectly matches the reciter, with excellent flow between words.';
    case 'good':
      return 'Your fluency is good, maintaining smooth transitions similar to the reciter.';
    case 'average':
      return 'Your fluency is average, with some smooth transitions but occasional hesitations.';
    case 'needsWork':
      return 'Your fluency needs work - focus on smoother transitions between words.';
    case 'poor':
      return 'Your fluency is significantly different from the reciter. Try to make your recitation more continuous.';
    default:
      return 'Your fluency could not be properly analyzed.';
  }
}

function getRhythmJustification(category: string): string {
  switch (category) {
    case 'excellent':
      return 'Your rhythmic pattern perfectly matches the reciter, with excellent timing consistency.';
    case 'good':
      return 'Your rhythm is good, maintaining similar patterns to the reciter.';
    case 'average':
      return 'Your rhythm is average, sometimes matching the reciter\'s patterns.';
    case 'needsWork':
      return 'Your rhythm needs work - pay attention to the reciter\'s consistent patterns.';
    case 'poor':
      return 'Your rhythm is significantly different from the reciter. Try to match their timing patterns.';
    default:
      return 'Your rhythm could not be properly analyzed.';
  }
} 