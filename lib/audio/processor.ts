/**
 * Core Audio Processing Library
 * Implements advanced audio feature extraction:
 * - TensorFlow.js integration with speech-commands model
 * - Mel spectrogram generation (128 bands)
 * - Enhanced MFCC extraction (20+ coefficients)
 * - Chroma feature extraction
 * - Feature fusion with vowel emphasis
 */

import * as tf from '@tensorflow/tfjs';
// Note about TensorFlow.js Node backend:
// We're not directly importing @tensorflow/tfjs-node here because it causes
// build issues with Next.js. For production, consider using a custom server
// or edge runtime where you can use the Node backend directly.

import AudioConfig from '@/config/audio';
import { preprocessAudio, splitIntoFrames } from './preprocessor';
import { createDynamicTimeWarping } from '../matching/similaritySearch';

// Load tensorflow speech commands model
let speechCommandsModel: tf.LayersModel | null = null;

/**
 * Initialize the TensorFlow.js model for feature extraction
 */
async function initializeModel(): Promise<tf.LayersModel> {
  if (!speechCommandsModel) {
    try {
      // Load the pre-trained speech commands model
      speechCommandsModel = await tf.loadLayersModel(
        'https://storage.googleapis.com/tfjs-models/tfjs/speech-commands/v0.3/browser_fft/18w/model.json'
      );
      console.log('Speech commands model loaded successfully');
    } catch (error) {
      console.error('Error loading speech commands model:', error);
      throw new Error('Failed to load TensorFlow.js model');
    }
  }
  
  return speechCommandsModel;
}

/**
 * Main feature extraction pipeline
 * @param audioBuffer Raw audio buffer
 * @returns Extracted features object with all processed features
 */
export async function extractAudioFeatures(audioBuffer: ArrayBuffer): Promise<{
  mfcc: number[][];
  chroma: number[][];
  melSpectrogram: number[][];
  temporalFeatures: number[][];
  fusedFeatures: number[][];
  vectorEmbedding: number[];
}> {
  try {
    console.log('Starting feature extraction pipeline...');
    
    // Ensure model is loaded
    console.log('Loading TensorFlow.js model...');
    const model = await initializeModel();
    console.log('Model loaded successfully.');
    
    // Preprocess audio
    console.log('Preprocessing audio...');
    const processedAudio = await preprocessAudio(audioBuffer);
    console.log(`Audio preprocessing complete. Got ${processedAudio.length} samples.`);
    
    // Split into frames
    console.log('Splitting audio into frames...');
    const frames = splitIntoFrames(processedAudio);
    console.log(`Extracted ${frames.length} frames from audio`);
    
    // Calculate different features
    console.log('Extracting MFCC features...');
    const mfccFeatures = await extractMFCC(frames);
    console.log(`MFCC extraction complete. Got ${mfccFeatures.length} MFCC frames.`);
    
    console.log('Extracting chroma features...');
    const chromaFeatures = await extractChroma(frames);
    console.log(`Chroma extraction complete. Got ${chromaFeatures.length} chroma frames.`);
    
    console.log('Extracting mel spectrogram features...');
    const melSpectrogramFeatures = await extractMelSpectrogram(frames, model);
    console.log(`Mel spectrogram extraction complete. Got ${melSpectrogramFeatures.length} spectrogram frames.`);
    
    console.log('Extracting temporal features...');
    const temporalFeatures = await extractTemporalFeatures(frames);
    console.log(`Temporal features extraction complete. Got ${temporalFeatures.length} temporal frames.`);
    
    // Perform feature fusion
    console.log('Performing feature fusion...');
    const fusedFeatures = fuseFeatures(
      mfccFeatures, 
      chromaFeatures,
      melSpectrogramFeatures,
      temporalFeatures
    );
    console.log(`Feature fusion complete. Got ${fusedFeatures.length} fused feature frames.`);
    
    // Create final vector embedding
    console.log('Creating vector embedding...');
    const vectorEmbedding = createVectorEmbedding(fusedFeatures);
    console.log(`Vector embedding created with dimension: ${vectorEmbedding.length}`);
    
    console.log('Feature extraction pipeline completed successfully.');
    return {
      mfcc: mfccFeatures,
      chroma: chromaFeatures,
      melSpectrogram: melSpectrogramFeatures,
      temporalFeatures,
      fusedFeatures,
      vectorEmbedding
    };
  } catch (error) {
    console.error('Error extracting audio features:', error);
    throw new Error(`Feature extraction failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract MFCC features from audio frames
 */
async function extractMFCC(frames: Float32Array[]): Promise<number[][]> {
  const numCoefficients = AudioConfig.features.mfcc.numCoefficients;
  const minFreq = AudioConfig.features.mfcc.minFrequency;
  const maxFreq = AudioConfig.features.mfcc.maxFrequency;
  const sampleRate = AudioConfig.preprocessing.targetSampleRate;
  
  const mfccs: number[][] = [];
  
  for (const frame of frames) {
    try {
      // Convert frame to tensor
      const frameTensor = tf.tensor1d(frame);
      
      // Apply window function (Hann window)
      const windowedFrame = applyWindow(frameTensor, 'hann');
      
      // Compute power spectrum
      const fft = tf.spectral.rfft(windowedFrame);
      const powerSpectrum = tf.square(tf.abs(fft));
      
      // Create mel filterbank
      const melFilterbank = createMelFilterbank(
        powerSpectrum.shape[0],
        minFreq,
        maxFreq,
        sampleRate,
        AudioConfig.features.melSpectrogram.numBands
      );
      
      // Apply mel filterbank
      const melEnergies = tf.matMul(
        powerSpectrum.expandDims(0),
        melFilterbank.transpose()
      ).squeeze();
      
      // Take log of mel energies
      const logMelEnergies = tf.log(tf.add(melEnergies, tf.scalar(1e-6)));
      
      // Apply DCT to get MFCCs
      const mfcc = dct(logMelEnergies).slice(0, numCoefficients);
      
      // Convert to array and push to results
      mfccs.push(Array.from(await mfcc.array()));
      
      // Clean up tensors
      frameTensor.dispose();
      windowedFrame.dispose();
      fft.dispose();
      powerSpectrum.dispose();
      melFilterbank.dispose();
      melEnergies.dispose();
      logMelEnergies.dispose();
      mfcc.dispose();
    } catch (err) {
      console.error('Error extracting MFCC from frame:', err);
    }
  }
  
  return mfccs;
}

/**
 * Extract chroma features (pitch-class distribution)
 */
async function extractChroma(frames: Float32Array[]): Promise<number[][]> {
  const sampleRate = AudioConfig.preprocessing.targetSampleRate;
  const numBands = AudioConfig.features.chroma.numBands;
  
  const chromaFeatures: number[][] = [];
  
  for (const frame of frames) {
    try {
      // Convert frame to tensor
      const frameTensor = tf.tensor1d(frame);
      
      // Apply window function
      const windowedFrame = applyWindow(frameTensor, 'hann');
      
      // Compute FFT
      const fft = tf.spectral.rfft(windowedFrame);
      const magnitudeSpectrum = tf.abs(fft);
      
      // Create chroma filterbank (maps frequencies to 12 pitch classes)
      const chromaFilterbank = createChromaFilterbank(
        magnitudeSpectrum.shape[0],
        sampleRate,
        numBands
      );
      
      // Apply chroma filterbank
      const chroma = tf.matMul(
        magnitudeSpectrum.expandDims(0),
        chromaFilterbank.transpose()
      ).squeeze();
      
      // Normalize chroma vector
      const chromaSum = tf.sum(chroma);
      const normalizedChroma = tf.div(chroma, tf.add(chromaSum, tf.scalar(1e-6)));
      
      // Convert to array and push to results
      chromaFeatures.push(Array.from(await normalizedChroma.array()));
      
      // Clean up tensors
      frameTensor.dispose();
      windowedFrame.dispose();
      fft.dispose();
      magnitudeSpectrum.dispose();
      chromaFilterbank.dispose();
      chroma.dispose();
      chromaSum.dispose();
      normalizedChroma.dispose();
    } catch (err) {
      console.error('Error extracting chroma features from frame:', err);
    }
  }
  
  return chromaFeatures;
}

/**
 * Extract mel spectrogram using TensorFlow model
 */
async function extractMelSpectrogram(
  frames: Float32Array[],
  model: tf.LayersModel
): Promise<number[][]> {
  const numBands = AudioConfig.features.melSpectrogram.numBands;
  const melSpectrograms: number[][] = [];
  
  // Process frames in batches to avoid memory issues
  const batchSize = 32;
  for (let i = 0; i < frames.length; i += batchSize) {
    const batch = frames.slice(i, i + batchSize);
    
    try {
      // Create a tensor of the batch
      const batchTensor = tf.stack(batch.map(frame => tf.tensor1d(frame)));
      
      // Get the intermediate layer output (mel spectrogram)
      const melLayer = model.getLayer('mel_spectrogram');
      const melModel = tf.model({
        inputs: model.inputs,
        outputs: melLayer.output
      });
      
      // Run inference to get mel spectrograms
      const spectrograms = melModel.predict(batchTensor) as tf.Tensor;
      
      // Resize to desired number of mel bands if necessary
      let processedSpectrograms = spectrograms;
      if (spectrograms.shape[1] !== numBands) {
        processedSpectrograms = tf.image.resizeBilinear(
          spectrograms.expandDims(-1),
          [numBands, spectrograms.shape[2]]
        ).squeeze(-1);
      }
      
      // Convert to array and push to results
      for (let j = 0; j < batch.length; j++) {
        const spectrogram = tf.slice(processedSpectrograms, [j, 0, 0], [1, -1, -1]).squeeze();
        melSpectrograms.push(Array.from(await spectrogram.array()));
        spectrogram.dispose();
      }
      
      // Clean up tensors
      batchTensor.dispose();
      spectrograms.dispose();
      if (processedSpectrograms !== spectrograms) {
        processedSpectrograms.dispose();
      }
    } catch (err) {
      console.error('Error extracting mel spectrogram from batch:', err);
    }
  }
  
  return melSpectrograms;
}

/**
 * Extract temporal features tracking speed variations
 */
async function extractTemporalFeatures(frames: Float32Array[]): Promise<number[][]> {
  const temporalFeatures: number[][] = [];
  
  // Skip if there are too few frames
  if (frames.length < 3) {
    return [new Array(5).fill(0)];
  }
  
  // Calculate frame-to-frame differences (delta features)
  for (let i = 1; i < frames.length; i++) {
    const currentFrame = frames[i];
    const previousFrame = frames[i - 1];
    
    // Calculate energy (RMS)
    const currentEnergy = calculateRMS(currentFrame);
    const previousEnergy = calculateRMS(previousFrame);
    const energyDelta = currentEnergy - previousEnergy;
    
    // Calculate zero crossing rate
    const currentZCR = calculateZCR(currentFrame);
    const previousZCR = calculateZCR(previousFrame);
    const zcrDelta = currentZCR - previousZCR;
    
    // Calculate spectral centroid
    const currentCentroid = calculateSpectralCentroid(currentFrame);
    const previousCentroid = calculateSpectralCentroid(previousFrame);
    const centroidDelta = currentCentroid - previousCentroid;
    
    // Calculate temporal features
    temporalFeatures.push([
      energyDelta,            // Energy change
      zcrDelta,               // Articulation change
      centroidDelta,          // Spectral change
      Math.abs(energyDelta),  // Magnitude of energy change
      i > 1 ? temporalFeatures[i-2][0] - energyDelta : 0 // Acceleration
    ]);
  }
  
  // Add first frame to maintain size
  temporalFeatures.unshift(temporalFeatures[0] || new Array(5).fill(0));
  
  return temporalFeatures;
}

/**
 * Fuse different features with emphasis on vowel-heavy segments
 */
function fuseFeatures(
  mfcc: number[][],
  chroma: number[][],
  melSpectrogram: number[][],
  temporalFeatures: number[][]
): number[][] {
  const fusedFeatures: number[][] = [];
  
  // Ensure all feature arrays have the same length
  const minLength = Math.min(
    mfcc.length,
    chroma.length,
    melSpectrogram.length,
    temporalFeatures.length
  );
  
  // Weights from config
  const mfccWeight = AudioConfig.fusion.mfccWeight;
  const chromaWeight = AudioConfig.fusion.chromaWeight;
  const temporalWeight = AudioConfig.fusion.temporalWeight;
  
  for (let i = 0; i < minLength; i++) {
    // Detect if this frame is vowel-heavy (based on energy in certain frequency bands)
    const isVowelHeavy = detectVowel(melSpectrogram[i]);
    
    // Apply vowel emphasis if needed
    const vowelMultiplier = isVowelHeavy ? AudioConfig.fusion.vowelEmphasis : 1.0;
    
    // Combine features
    const fusedFrame: number[] = [
      // Weighted MFCC features
      ...mfcc[i].map(val => val * mfccWeight * vowelMultiplier),
      
      // Weighted chroma features
      ...chroma[i].map(val => val * chromaWeight),
      
      // Weighted temporal features
      ...temporalFeatures[i].map(val => val * temporalWeight)
    ];
    
    fusedFeatures.push(fusedFrame);
  }
  
  return fusedFeatures;
}

/**
 * Create the final vector embedding for database storage
 */
function createVectorEmbedding(fusedFeatures: number[][]): number[] {
  const targetDimension = AudioConfig.vector.finalDimension;
  
  // If we don't have enough features, pad with zeros
  if (fusedFeatures.length === 0) {
    return new Array(targetDimension).fill(0);
  }
  
  // Flatten the 2D array into a 1D array
  const flattened = fusedFeatures.flat();
  
  // Resize to target dimension
  if (flattened.length === targetDimension) {
    return flattened;
  } else if (flattened.length < targetDimension) {
    // Pad with zeros
    return [...flattened, ...new Array(targetDimension - flattened.length).fill(0)];
  } else {
    // Subsample or use dimensionality reduction
    // For simple implementation, just subsample evenly
    const embedding: number[] = [];
    const step = flattened.length / targetDimension;
    
    for (let i = 0; i < targetDimension; i++) {
      const index = Math.min(Math.floor(i * step), flattened.length - 1);
      embedding.push(flattened[index]);
    }
    
    return embedding;
  }
}

// Utility functions
/**
 * Apply window function to a frame
 */
function applyWindow(frame: tf.Tensor1D, windowType: 'hann' | 'hamming' = 'hann'): tf.Tensor1D {
  const length = frame.shape[0];
  const windowFunction = tf.buffer([length]);
  
  for (let i = 0; i < length; i++) {
    if (windowType === 'hann') {
      // Hann window
      windowFunction.set(0.5 * (1 - Math.cos(2 * Math.PI * i / (length - 1))), i);
    } else {
      // Hamming window
      windowFunction.set(0.54 - 0.46 * Math.cos(2 * Math.PI * i / (length - 1)), i);
    }
  }
  
  return tf.mul(frame, windowFunction.toTensor());
}

/**
 * Create mel filterbank for MFCC calculation
 */
function createMelFilterbank(
  fftSize: number,
  minFreq: number,
  maxFreq: number,
  sampleRate: number,
  numBands: number
): tf.Tensor2D {
  // Convert frequencies to mel scale
  const hzToMel = (hz: number) => 2595 * Math.log10(1 + hz / 700);
  const melToHz = (mel: number) => 700 * (Math.pow(10, mel / 2595) - 1);
  
  const minMel = hzToMel(minFreq);
  const maxMel = hzToMel(maxFreq);
  
  // Create equally spaced points on mel scale
  const melPoints = tf.linspace(minMel, maxMel, numBands + 2).arraySync() as number[];
  
  // Convert back to Hz and then to FFT bins
  const fftBins = melPoints.map(mel => Math.floor((fftSize - 1) * melToHz(mel) / (sampleRate / 2)));
  
  // Create filterbank matrix
  const filterbank = tf.buffer([fftSize, numBands]);
  
  for (let i = 0; i < numBands; i++) {
    const leftBin = fftBins[i];
    const centerBin = fftBins[i + 1];
    const rightBin = fftBins[i + 2];
    
    for (let j = leftBin; j < centerBin; j++) {
      filterbank.set((j - leftBin) / (centerBin - leftBin), j, i);
    }
    
    for (let j = centerBin; j < rightBin; j++) {
      filterbank.set((rightBin - j) / (rightBin - centerBin), j, i);
    }
  }
  
  return filterbank.toTensor();
}

/**
 * Create chroma filterbank for pitch class extraction
 */
function createChromaFilterbank(
  fftSize: number,
  sampleRate: number,
  numBands: number = 12
): tf.Tensor2D {
  // A4 = 440Hz is a reference
  const A4 = 440;
  const A4Index = 69; // MIDI note number for A4
  
  // Create filterbank matrix
  const filterbank = tf.buffer([fftSize, numBands]);
  
  // For each FFT bin, calculate the corresponding pitch class
  for (let i = 0; i < fftSize; i++) {
    // Calculate frequency in Hz
    const freq = i * sampleRate / (2 * fftSize);
    
    if (freq > 0) {
      // Convert frequency to MIDI note number
      const noteNumber = 12 * Math.log2(freq / A4) + A4Index;
      
      // Calculate pitch class (0-11, where 0 is C)
      const pitchClass = Math.round(noteNumber) % 12;
      
      // Add weight to this bin for the corresponding pitch class
      // Weight is based on proximity to exact note frequency
      const exactNoteNumber = Math.round(noteNumber);
      const distance = Math.abs(noteNumber - exactNoteNumber);
      const weight = Math.max(0, 1 - distance);
      
      filterbank.set(weight, i, pitchClass);
    }
  }
  
  return filterbank.toTensor();
}

/**
 * Discrete Cosine Transform implementation
 */
function dct(input: tf.Tensor1D): tf.Tensor1D {
  const N = input.shape[0];
  
  // Create DCT matrix
  const dctMatrix = tf.buffer([N, N]);
  
  for (let k = 0; k < N; k++) {
    for (let n = 0; n < N; n++) {
      dctMatrix.set(
        Math.cos(Math.PI * k * (2 * n + 1) / (2 * N)),
        k, n
      );
    }
  }
  
  // Apply scaling factors
  for (let k = 0; k < N; k++) {
    const scaleFactor = (k === 0) ? Math.sqrt(1 / N) : Math.sqrt(2 / N);
    for (let n = 0; n < N; n++) {
      dctMatrix.set(
        dctMatrix.get(k, n) * scaleFactor,
        k, n
      );
    }
  }
  
  // Apply DCT matrix to input
  return tf.matMul(dctMatrix.toTensor(), input.expandDims(1)).squeeze();
}

/**
 * Calculate Root Mean Square (RMS) energy of a frame
 */
function calculateRMS(frame: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) {
    sum += frame[i] * frame[i];
  }
  return Math.sqrt(sum / frame.length);
}

/**
 * Calculate Zero Crossing Rate (ZCR) of a frame
 */
function calculateZCR(frame: Float32Array): number {
  let crossings = 0;
  for (let i = 1; i < frame.length; i++) {
    if ((frame[i] >= 0 && frame[i - 1] < 0) || 
        (frame[i] < 0 && frame[i - 1] >= 0)) {
      crossings++;
    }
  }
  return crossings / (frame.length - 1);
}

/**
 * Calculate spectral centroid of a frame
 */
function calculateSpectralCentroid(frame: Float32Array): number {
  // Convert to tensor
  const frameTensor = tf.tensor1d(frame);
  
  // Apply window
  const windowedFrame = applyWindow(frameTensor, 'hann');
  
  // Calculate FFT
  const fft = tf.spectral.rfft(windowedFrame);
  const magnitudes = tf.abs(fft);
  
  // Calculate frequencies for each bin
  const fftSize = frame.length;
  const sampleRate = AudioConfig.preprocessing.targetSampleRate;
  const frequencies = tf.linspace(0, sampleRate / 2, Math.floor(fftSize / 2) + 1);
  
  // Calculate weighted sum
  const weightedSum = tf.sum(tf.mul(magnitudes, frequencies));
  const magnitudeSum = tf.sum(magnitudes);
  
  // Calculate centroid
  const centroid = tf.div(weightedSum, tf.add(magnitudeSum, tf.scalar(1e-6)));
  
  // Get value and clean up
  const result = centroid.dataSync()[0];
  
  frameTensor.dispose();
  windowedFrame.dispose();
  fft.dispose();
  magnitudes.dispose();
  frequencies.dispose();
  weightedSum.dispose();
  magnitudeSum.dispose();
  centroid.dispose();
  
  return result;
}

/**
 * Detect if a frame likely contains a vowel
 */
function detectVowel(melSpectrum: number[]): boolean {
  // Vowels typically have:
  // 1. Higher energy in lower formants
  // 2. Clearer formant structure
  
  if (!melSpectrum || melSpectrum.length < 20) {
    return false;
  }
  
  // Focus on bands that typically contain vowel formants (F1, F2, F3)
  // These are rough approximations and would need tuning for Arabic
  const f1BandStart = 2;   // ~300Hz region
  const f1BandEnd = 6;     // ~800Hz region
  const f2BandStart = 8;   // ~1000Hz region
  const f2BandEnd = 14;    // ~2000Hz region
  
  // Calculate energy in formant regions
  let f1Energy = 0;
  let f2Energy = 0;
  let totalEnergy = 0;
  
  for (let i = 0; i < melSpectrum.length; i++) {
    const energy = melSpectrum[i];
    totalEnergy += energy;
    
    if (i >= f1BandStart && i <= f1BandEnd) {
      f1Energy += energy;
    } else if (i >= f2BandStart && i <= f2BandEnd) {
      f2Energy += energy;
    }
  }
  
  // Calculate ratios
  const f1Ratio = f1Energy / totalEnergy;
  const f2Ratio = f2Energy / totalEnergy;
  
  // Higher first formant energy and significant second formant energy
  // are characteristic of vowels
  return f1Ratio > 0.15 && f2Ratio > 0.1;
}

// Export all processing functions for testing/utility
export {
  initializeModel,
  extractMFCC,
  extractChroma,
  extractMelSpectrogram,
  extractTemporalFeatures,
  fuseFeatures,
  createVectorEmbedding,
  detectVowel
}; 