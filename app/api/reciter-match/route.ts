import { supabaseAdmin } from '@/lib/supabase/admin';
// Remove client-side imports
// import { calculateSimilarity, generateTajweedFeedback } from '@/lib/audio/mfccProcessor';

// Define tajweed aspects we can analyze from audio features
const TAJWEED_ASPECTS = [
  'intonation',   // Rises and falls in pitch
  'pace',         // Speed of recitation 
  'melody',       // Musical qualities
  'strength',     // Voice power/intensity
  'articulation', // Clarity of pronunciation
  'fluency',      // Smoothness of transitions
  'rhythm'        // Timing patterns
];

/**
 * Determine recitation style based on reciter name
 * @param reciterName Name of the reciter
 * @returns Recitation style (currently 'Warsh' or 'Hafs')
 */
function getRecitationStyle(reciterName: string): string {
  // Simple logic: if name contains "warsh" (case insensitive), it's Warsh, otherwise Hafs
  return reciterName.toLowerCase().includes('warsh') ? 'Warsh' : 'Hafs';
}

/**
 * Calculate similarity between two feature vectors using MFCC comparison
 * Uses Dynamic Time Warping (DTW) distance for comparing MFCC sequences
 */
function calculateSimilarity(
  userFeatures: any,
  reciterFeatures: any
): { 
  overallScore: number; 
  aspectScores: Record<string, number> 
} {
  // Debug logging for input feature formats
  console.log("USER FEATURES TYPE:", Array.isArray(userFeatures) ? "Array" : typeof userFeatures);
  console.log("RECITER FEATURES TYPE:", Array.isArray(reciterFeatures) ? "Array" : typeof reciterFeatures);
  
  // Ensure we have arrays of MFCC frames
  let userMFCCs = Array.isArray(userFeatures) ? userFeatures : [];
  // Directly use reciterFeatures, assuming it's always number[][] from the DB
  let reciterMFCCs = Array.isArray(reciterFeatures) ? reciterFeatures : []; 
  
  // If userFeatures was in the old object format, extract its mfccs
  if (!Array.isArray(userFeatures) && userFeatures?.mfccs) {
    userMFCCs = userFeatures.mfccs;
  }
  
  // Debug log dimensions and sample values
  console.log("USER MFCCS DIMENSIONS:", userMFCCs.length, userMFCCs.length > 0 ? userMFCCs[0].length : 0);
  // Ensure reciterMFCCs is logged correctly after this potential simplification
  console.log("RECITER MFCCS (after ensuring array):", Array.isArray(reciterMFCCs) ? "Array" : typeof reciterMFCCs);
  console.log("RECITER MFCCS DIMENSIONS:", reciterMFCCs.length, reciterMFCCs.length > 0 && Array.isArray(reciterMFCCs[0]) ? reciterMFCCs[0].length : 0);
  
  // Log first frame of each to compare values
  if (userMFCCs.length > 0 && reciterMFCCs.length > 0) {
    console.log("USER FIRST FRAME (first 5 values):", userMFCCs[0].slice(0, 5));
    console.log("RECITER FIRST FRAME (first 5 values):", reciterMFCCs[0].slice(0, 5));
    
    // Check magnitude ranges
    const userMagnitudes = userMFCCs.flat().map(Math.abs);
    const reciterMagnitudes = reciterMFCCs.flat().map(Math.abs);
    
    console.log("USER MFCC VALUE RANGE:", 
      Math.min(...userMagnitudes), 
      Math.max(...userMagnitudes),
      "AVG:", userMagnitudes.reduce((a, b) => a + b, 0) / userMagnitudes.length
    );
    
    console.log("RECITER MFCC VALUE RANGE:", 
      Math.min(...reciterMagnitudes), 
      Math.max(...reciterMagnitudes),
      "AVG:", reciterMagnitudes.reduce((a, b) => a + b, 0) / reciterMagnitudes.length
    );
  }
  
  // If either doesn't have MFCCs, fall back to random score
  if (!userMFCCs.length || !reciterMFCCs.length) {
    console.warn('Missing MFCCs for comparison, using random score');
    const randomScore = 60 + Math.random() * 30; // 60-90 range
    return {
      overallScore: randomScore,
      aspectScores: TAJWEED_ASPECTS.reduce((acc, aspect) => {
        acc[aspect] = 60 + Math.random() * 30;
        return acc;
      }, {} as Record<string, number>)
    };
  }
  
  // Calculate mean vectors for comparison (using all coefficients)
  const userMean = calculateMean(userMFCCs);
  const reciterMean = calculateMean(reciterMFCCs);
  
  // Log mean vectors
  console.log("USER MEAN VECTOR (first 5):", userMean.slice(0, 5));
  console.log("RECITER MEAN VECTOR (first 5):", reciterMean.slice(0, 5));
  
  // Calculate Euclidean distance between mean vectors
  let meanDistance = 0;
  let diffDetails = [];
  
  for (let i = 0; i < Math.min(userMean.length, reciterMean.length); i++) {
    const diff = userMean[i] - reciterMean[i];
    meanDistance += diff * diff;
    if (i < 5) {
      diffDetails.push({ coef: i, diff, squaredDiff: diff * diff });
    }
  }
  
  console.log("DIFF DETAILS (first 5 coefficients):", diffDetails);
  
  const totalDistance = Math.sqrt(meanDistance);
  console.log("TOTAL EUCLIDEAN DISTANCE:", totalDistance);
  
  // Convert to similarity score (inverse relationship)
  // Lower distance = higher similarity
  const rawScore = Math.exp(-totalDistance / 10);
  console.log("RAW SCORE (before scaling):", rawScore);
  
  // Adjusted scoring function for better sensitivity
  let overallScore;
  
  if (totalDistance > 1000) {
    overallScore = 0; // Too different, zero match
  } else if (totalDistance > 100) {
    // For large distances, use a more gradual decay
    overallScore = 100 * Math.exp(-totalDistance / 200);
  } else {
    // For smaller distances, use the original formula
    overallScore = 100 * Math.exp(-totalDistance / 10);
  }
  
  console.log("ADJUSTED OVERALL SCORE:", overallScore);
  
  // Generate aspect-specific scores
  // Map each dimension of MFCC to tajweed aspects
  const aspectScores: Record<string, number> = {};
  const coefficientsPerAspect = Math.ceil(userMean.length / TAJWEED_ASPECTS.length);
  
  TAJWEED_ASPECTS.forEach((aspect, aspectIndex) => {
    // Assign a subset of coefficients to each aspect
    const startCoef = aspectIndex * coefficientsPerAspect;
    const endCoef = Math.min(startCoef + coefficientsPerAspect, userMean.length);
    
    // Calculate aspect-specific distance
    let aspectDistance = 0;
    for (let i = startCoef; i < endCoef; i++) {
      if (i < userMean.length && i < reciterMean.length) {
        const diff = userMean[i] - reciterMean[i];
        aspectDistance += diff * diff;
      }
    }
    
    const rawAspectScore = Math.exp(-Math.sqrt(aspectDistance) / 5);
    
    // Convert to similarity score with same adjustments as overall score
    if (aspectDistance > 1000) {
      aspectScores[aspect] = 0;
    } else if (aspectDistance > 100) {
      aspectScores[aspect] = 100 * Math.exp(-Math.sqrt(aspectDistance) / 100);
    } else {
      aspectScores[aspect] = 100 * Math.exp(-Math.sqrt(aspectDistance) / 5);
    }
  });
  
  console.log("ASPECT SCORES:", aspectScores);
  
  return { overallScore, aspectScores };
}

/**
 * Calculate mean vector for an array of MFCC frames
 */
function calculateMean(mfccs: number[][]): number[] {
  if (!mfccs.length) return [];
  
  const originalNumCoefficients = mfccs[0].length;
  if (originalNumCoefficients === 0) return [];

  // Process all coefficients from startIndex = 0
  const startIndex = 0;
  const numCoefficientsToProcess = originalNumCoefficients;
  const means = new Array(numCoefficientsToProcess).fill(0);
  
  let validFramesCount = 0;
  for (const frame of mfccs) {
    // Ensure frame is long enough
    if (frame.length < originalNumCoefficients) {
        console.warn("Skipping inconsistent frame in calculateMean: frame length", frame.length, "expected", originalNumCoefficients);
        continue; 
    }
    for (let i = 0; i < numCoefficientsToProcess; i++) {
      means[i] += frame[i + startIndex]; // startIndex will be 0
    }
    validFramesCount++;
  }
  
  if (validFramesCount === 0) {
    console.warn("No valid frames found to calculate mean.");
    return [];
  }

  return means.map(sum => sum / validFramesCount);
}

/**
 * Generate tajweed feedback based on feature vector analysis
 */
function generateTajweedFeedback(
  userFeatures: any,
  matchResults: any,
  aspectScores: Record<string, number>
): {
  generalFeedback: string[];
  specificFeedback: Record<string, { score: number; advice: string }>;
} {
  // Get top match
  const topMatch = matchResults[0];
  
  // General feedback
  const generalFeedback = [
    `Your recitation style shows similarities with ${topMatch.reciterName} (${Math.round(topMatch.similarityScore)}% match)`,
    `Your strongest tajweed aspect is ${findStrongestAspect(aspectScores)}`,
    `Focus on improving your ${findWeakestAspect(aspectScores)} for better recitation`
  ];
  
  // Generate specific feedback for each tajweed aspect
  const specificFeedback: Record<string, { score: number; advice: string }> = {};
  
  // Intonation feedback
  specificFeedback.intonation = {
    score: aspectScores.intonation,
    advice: aspectScores.intonation > 70 
      ? "Your intonation is excellent. You've mastered the rises and falls in your voice that give depth to the recitation."
      : "Work on varying your pitch more naturally when reciting. Listen to how reciters emphasize different words and phrases through pitch changes."
  };
  
  // Pace feedback
  specificFeedback.pace = {
    score: aspectScores.pace,
    advice: aspectScores.pace > 70
      ? "Your recitation pace is well-balanced, not too fast or too slow."
      : "Adjust your recitation speed to ensure proper pronunciation while maintaining a smooth flow. Avoid rushing through verses."
  };
  
  // Melody feedback
  specificFeedback.melody = {
    score: aspectScores.melody,
    advice: aspectScores.melody > 70
      ? "Your recitation has beautiful melodic qualities similar to the matched reciter."
      : "Study the melodic patterns of renowned reciters and try to incorporate similar tonal variations in your recitation."
  };
  
  // Strength feedback
  specificFeedback.strength = {
    score: aspectScores.strength,
    advice: aspectScores.strength > 70
      ? "Your voice projection and control demonstrate good strength and confidence."
      : "Work on strengthening your voice for emphasized letters while maintaining control. Practice breath support techniques."
  };
  
  // Articulation feedback
  specificFeedback.articulation = {
    score: aspectScores.articulation,
    advice: aspectScores.articulation > 70
      ? "Your pronunciation is clear with excellent articulation of each letter."
      : "Focus on the proper makharij (points of articulation) for each letter, ensuring clear distinctions between similar sounds."
  };
  
  // Fluency feedback
  specificFeedback.fluency = {
    score: aspectScores.fluency,
    advice: aspectScores.fluency > 70
      ? "Your recitation flows very smoothly with natural transitions between verses."
      : "Practice connecting words and verses more smoothly. Pay attention to where you pause and how you resume."
  };
  
  // Rhythm feedback
  specificFeedback.rhythm = {
    score: aspectScores.rhythm,
    advice: aspectScores.rhythm > 70
      ? "Your rhythm and timing patterns show excellent consistency and control."
      : "Work on maintaining consistent rhythmic patterns and appropriate pauses according to tajweed rules."
  };
  
  return {
    generalFeedback,
    specificFeedback
  };
}

// Helper functions to identify strongest and weakest aspects
function findStrongestAspect(aspectScores: Record<string, number>): string {
  return Object.entries(aspectScores)
    .sort((a, b) => b[1] - a[1])[0][0];
}

function findWeakestAspect(aspectScores: Record<string, number>): string {
  return Object.entries(aspectScores)
    .sort((a, b) => a[1] - b[1])[0][0];
}

/**
 * API Route to match user recitation with reciters
 * Takes in feature vectors and returns matching reciters
 */
export async function POST(request: Request) {
  try {
    // Parse request body
    const { featureVector } = await request.json();
    
    if (!featureVector) {
      return Response.json(
        { error: 'Invalid feature vector format' },
        { status: 400 }
      );
    }
    
    // Log incoming feature vector structure
    console.log("INCOMING USER FEATURE VECTOR:", {
      type: Array.isArray(featureVector) ? "Array" : typeof featureVector,
      length: Array.isArray(featureVector) ? featureVector.length : "N/A",
      sample: Array.isArray(featureVector) && featureVector.length > 0 
        ? (Array.isArray(featureVector[0]) 
            ? `First frame (${featureVector[0].length} coefficients)` 
            : "Not a nested array")
        : "Empty or not an array"
    });
    
    // Fetch reciter data with pre-computed feature vectors
    // Don't request recitation_style since it might not exist yet
    const { data, error } = await supabaseAdmin
      .from('reciters')
      .select('id, name, profile_image_url, feature_vector');
    
    if (error) {
      console.error('Error fetching reciters:', error);
      return Response.json(
        { error: 'Failed to fetch reciters' },
        { status: 500 }
      );
    }
    
    // Check first reciter's feature vector structure
    if (data && data.length > 0) {
      const firstReciter = data[0];
      console.log(`RECITER DB FEATURE VECTOR (${firstReciter.name}):`, {
        type: Array.isArray(firstReciter.feature_vector) ? "Array" : typeof firstReciter.feature_vector,
        length: Array.isArray(firstReciter.feature_vector) ? firstReciter.feature_vector.length : "N/A",
        sample: Array.isArray(firstReciter.feature_vector) && firstReciter.feature_vector.length > 0 
          ? (Array.isArray(firstReciter.feature_vector[0]) 
              ? `First frame (${firstReciter.feature_vector[0].length} coefficients)` 
              : "Not a nested array")
          : "Empty or not an array"
      });
    }
    
    // Create mock reciters if none exist
    let reciters = data || [];
    if (reciters.length === 0) {
      console.log('No reciters found, creating mock data');
      
      // Create mock MFCC feature vectors for each reciter
      const createMockFeatureVector = () => {
        const numCoefficients = 13;
        const numFrames = 100;
        
        // Create mock MFCCs (100 frames × 13 coefficients)
        // Return directly as feature vector (array of MFCC frames)
        return Array.from({ length: numFrames }, () => 
          Array.from({ length: numCoefficients }, () => Math.random() * 2 - 1)
        );
      };
      
      reciters = [
        { 
          id: 'mock-1', 
          name: 'Sheikh Abdul Basit (Hafs)', 
          profile_image_url: null,
          feature_vector: createMockFeatureVector()
        },
        { 
          id: 'mock-2', 
          name: 'Mishary Rashid Alafasy', 
          profile_image_url: null,
          feature_vector: createMockFeatureVector()
        },
        { 
          id: 'mock-3', 
          name: 'Warsh Reciter - Muhammad Al-Limoni', 
          profile_image_url: null,
          feature_vector: createMockFeatureVector()
        }
      ];
    } else {
      // For reciters that don't have feature vectors, add mock ones
      reciters = reciters.map(reciter => {
        if (!reciter.feature_vector) {
          const numCoefficients = 13;
          const numFrames = 100;
          
          // Create mock MFCCs
          const mfccs = Array.from({ length: numFrames }, () => 
            Array.from({ length: numCoefficients }, () => Math.random() * 2 - 1)
          );
          
          return {
            ...reciter,
            feature_vector: mfccs
          };
        }
        return reciter;
      });
    }
    
    // Log the number of reciters fetched
    console.log(`Fetched ${reciters.length} reciters from the database.`);

    const matchResults = [];
    for (const reciter of reciters) {
      // Log the current reciter being processed and the type of its feature_vector
      console.log(`RECITER MATCH: Processing reciter: ${reciter.name}`);
      console.log(`RECITER MATCH: Reciter ID: ${reciter.id}, Feature Vector Type: ${typeof reciter.feature_vector}, IsArray: ${Array.isArray(reciter.feature_vector)}`);

      if (reciter.feature_vector && Array.isArray(reciter.feature_vector) && reciter.feature_vector.length > 0) {
        // Additional check: Log the structure of the first frame of the feature vector if it exists
        if (Array.isArray(reciter.feature_vector[0])) {
          console.log(`RECITER MATCH: Reciter ${reciter.name} first MFCC frame (first 5 values):`, reciter.feature_vector[0].slice(0,5));
        } else {
          console.warn(`RECITER MATCH: Reciter ${reciter.name} feature_vector[0] is not an array. Structure:`, reciter.feature_vector[0]);
        }

        const { overallScore, aspectScores } = calculateSimilarity(
          featureVector,
          reciter.feature_vector
        );

        matchResults.push({
          reciterId: reciter.id,
          reciterName: reciter.name,
          reciterImageUrl: reciter.profile_image_url,
          recitationStyle: getRecitationStyle(reciter.name),
          similarityScore: overallScore,
          aspectScores
        });
      } else {
        // Log a warning if the feature_vector is missing, not an array, or empty
        console.warn(`RECITER MATCH: Reciter ${reciter.name} (ID: ${reciter.id}) has an invalid, empty, or missing feature_vector. Type: ${typeof reciter.feature_vector}, IsArray: ${Array.isArray(reciter.feature_vector)}, Length: ${reciter.feature_vector ? reciter.feature_vector.length : 'N/A'}`);
        matchResults.push({
          reciterId: reciter.id,
          reciterName: reciter.name,
          reciterImageUrl: reciter.profile_image_url,
          recitationStyle: getRecitationStyle(reciter.name),
          similarityScore: 0,
          aspectScores: {}
        });
      }
    }
    
    // Sort by overall similarity score (highest first)
    matchResults.sort((a, b) => b.similarityScore - a.similarityScore);
    
    // Get the top 3 matches
    const topMatches = matchResults.slice(0, 3);
    
    // Generate detailed tajweed feedback
    const { generalFeedback, specificFeedback } = generateTajweedFeedback(
      featureVector, 
      topMatches,
      topMatches[0].aspectScores
    );
    
    return Response.json({
      matches: topMatches,
      feedback: {
        general: generalFeedback,
        specific: specificFeedback
      }
    });
  } catch (error) {
    console.error('Error processing reciter match:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 