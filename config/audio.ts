/**
 * Audio Processing Configuration
 * Contains all audio processing parameters for consistency across the application
 */

export const AudioConfig = {
  // Preprocessing parameters
  preprocessing: {
    targetSampleRate: 22050, // 22.05kHz mono as specified
    silenceThresholdDb: -30, // Silence threshold at -30dB
    normalizationPeakDb: -3, // Normalize to -3dB peak
    bandpassFilter: {
      lowCutHz: 80,  // Low cut at 80Hz
      highCutHz: 8000 // High cut at 8kHz
    },
    frameSize: 441, // 20ms at 22.05kHz
    hopSize: 220,   // 10ms overlap (50% of frame size)
  },
  
  // Feature extraction parameters
  features: {
    mfcc: {
      numCoefficients: 20, // Using 20 coefficients as specified (not 13)
      minFrequency: 80,    // Min frequency to analyze
      maxFrequency: 8000,  // Max frequency to analyze
    },
    melSpectrogram: {
      numBands: 128,       // 128 mel bands as specified
    },
    chroma: {
      numBands: 12,        // 12 semitones in an octave
    },
  },
  
  // Feature fusion weights
  fusion: {
    // Weight coefficients for feature fusion
    mfccWeight: 0.5,
    chromaWeight: 0.3,
    temporalWeight: 0.2,
    
    // Vowel detection parameters for weighting
    vowelEmphasis: 1.5,    // Multiplier for vowel-heavy segments
  },
  
  // Vector dimensions
  vector: {
    finalDimension: 1536,  // Final embedding dimension for pgvector
  },
  
  // Matching parameters
  matching: {
    windowSize: 5,         // Sliding window size for matching
    confidenceThreshold: 0.7, // Minimum confidence for a match
  }
};

// Named weights for different tajweed aspects
export const TajweedAspects = [
  'intonation',   // Rises and falls in pitch
  'pace',         // Speed of recitation 
  'melody',       // Musical qualities
  'strength',     // Voice power/intensity
  'articulation', // Clarity of pronunciation
  'fluency',      // Smoothness of transitions
  'rhythm'        // Timing patterns
];

// Export default configuration
export default AudioConfig; 