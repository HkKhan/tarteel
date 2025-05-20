// Test script for Meyda MFCC extraction
const Meyda = require('meyda');

console.log('Meyda version:', Meyda.version);
console.log('Available features:', Meyda.listAvailableFeatureExtractors());

// Create a simple test signal (sine wave)
function generateSineWave(frequency, duration, sampleRate) {
  const samples = Math.floor(duration * sampleRate);
  const signal = new Float32Array(samples);
  
  for (let i = 0; i < samples; i++) {
    signal[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
  }
  
  return signal;
}

// Extract MFCC features function (similar to the API route implementation)
function extractMFCCs(signal) {
  // Configure Meyda
  Meyda.numberOfMFCCCoefficients = 13;
  
  // Audio processing parameters
  const frameSize = 1024;
  const hopSize = 512;
  
  // Extract MFCCs frame by frame
  const mfccs = [];
  const frameCount = Math.floor((signal.length - frameSize) / hopSize) + 1;
  
  console.log(`Processing ${frameCount} frames...`);
  
  for (let i = 0; i < frameCount; i++) {
    const startIndex = i * hopSize;
    const frame = signal.slice(startIndex, startIndex + frameSize);
    
    try {
      // Extract features including MFCCs
      const features = Meyda.extract(["mfcc"], frame);
      
      if (features && Array.isArray(features.mfcc)) {
        mfccs.push(features.mfcc);
      }
    } catch (err) {
      console.error(`Error extracting features from frame ${i}:`, err);
    }
  }
  
  console.log(`Successfully extracted ${mfccs.length} MFCC frames`);
  
  // Calculate statistics
  const mfccMeans = calculateMeans(mfccs);
  const mfccStdDevs = calculateStdDevs(mfccs, mfccMeans);
  
  return {
    mfccs,
    mfccMeans,
    mfccStdDevs
  };
}

// Calculate mean values for each MFCC coefficient across frames
function calculateMeans(mfccs) {
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

// Calculate standard deviation for each MFCC coefficient across frames
function calculateStdDevs(mfccs, means) {
  if (mfccs.length === 0) return [];
  
  const numCoefficients = mfccs[0].length;
  const variances = new Array(numCoefficients).fill(0);
  
  for (const frame of mfccs) {
    for (let i = 0; i < numCoefficients; i++) {
      variances[i] += Math.pow(frame[i] - means[i], 2);
    }
  }
  
  return variances.map(variance => Math.sqrt(variance / mfccs.length));
}

// Test MFCC extraction
function testMeydaMFCC() {
  console.log('Testing Meyda MFCC extraction...');
  
  // Generate a test signal (440Hz sine wave, 1 second, 44.1kHz sample rate)
  const signal = generateSineWave(440, 1, 44100);
  
  // Try extracting single feature to verify basic functionality
  try {
    const zcr = Meyda.extract("zcr", signal.slice(0, 1024));
    console.log('Zero crossing rate test:', zcr);
  } catch (err) {
    console.error('Error during ZCR test:', err);
  }
  
  // Extract MFCCs using our full implementation
  try {
    const features = extractMFCCs(signal);
    console.log('Successfully extracted MFCCs');
    console.log('Number of coefficients:', features.mfccMeans.length);
    console.log('MFCC means:', features.mfccMeans);
    console.log('MFCC standard deviations:', features.mfccStdDevs);
  } catch (err) {
    console.error('Error extracting MFCCs:', err);
  }
}

testMeydaMFCC(); 