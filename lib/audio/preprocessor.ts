/**
 * Audio Preprocessor Module
 * Handles audio preprocessing tasks:
 * - Resampling to 22.05kHz mono
 * - Silence trimming with -30dB threshold
 * - Peak normalization to -3dB
 * - Bandpass filtering (80Hz-8kHz)
 * - Frame splitting (20ms frames, 10ms overlap)
 */

import AudioConfig from '@/config/audio';
import * as tf from '@tensorflow/tfjs';

/**
 * Main preprocessing pipeline for audio data
 * @param audioBuffer Raw audio buffer (ArrayBuffer)
 * @returns Processed float32Array ready for feature extraction
 */
export async function preprocessAudio(audioBuffer: ArrayBuffer): Promise<Float32Array> {
  try {
    // Convert ArrayBuffer to Float32Array
    const { floatData, sampleRate } = await convertToFloat32(audioBuffer);
    
    // Resample to target sample rate if necessary
    const resampledData = await resampleAudio(floatData, sampleRate, AudioConfig.preprocessing.targetSampleRate);
    
    // Apply bandpass filter
    const filteredData = applyBandpassFilter(
      resampledData, 
      AudioConfig.preprocessing.bandpassFilter.lowCutHz,
      AudioConfig.preprocessing.bandpassFilter.highCutHz,
      AudioConfig.preprocessing.targetSampleRate
    );
    
    // Trim silence
    const trimmedData = trimSilence(filteredData, AudioConfig.preprocessing.silenceThresholdDb);
    
    // Normalize audio
    const normalizedData = normalizeAudio(trimmedData, AudioConfig.preprocessing.normalizationPeakDb);
    
    return normalizedData;
  } catch (error) {
    console.error('Error preprocessing audio:', error);
    throw new Error('Audio preprocessing failed');
  }
}

/**
 * Convert ArrayBuffer to Float32Array using a simple approach that works in both browser and Node.js
 */
async function convertToFloat32(audioBuffer: ArrayBuffer): Promise<{ floatData: Float32Array, sampleRate: number }> {
  try {
    // For server-side execution, use a simple conversion approach
    // This assumes the audio is already in a format like PCM 16-bit
    const view = new Int16Array(audioBuffer);
    const floatData = new Float32Array(view.length);
    
    // Convert to float (-1 to 1)
    for (let i = 0; i < view.length; i++) {
      floatData[i] = view[i] / 32768; // Normalize Int16 to -1..1
    }
    
    // Assume a default sample rate (most common for audio files)
    const sampleRate = AudioConfig.preprocessing.targetSampleRate;
    
    console.log(`Converted audio buffer (${audioBuffer.byteLength} bytes) to Float32Array (${floatData.length} samples) with sample rate ${sampleRate}Hz`);
    
    return { floatData, sampleRate };
  } catch (error) {
    console.error('Error in convertToFloat32:', error);
    throw new Error('Failed to convert audio buffer to Float32Array');
  }
}

/**
 * Resample audio to target sample rate
 */
async function resampleAudio(
  audioData: Float32Array, 
  originalSampleRate: number, 
  targetSampleRate: number
): Promise<Float32Array> {
  // If already at target sample rate, return the original data
  if (originalSampleRate === targetSampleRate) {
    return audioData;
  }
  
  // Calculate resampling ratio
  const ratio = targetSampleRate / originalSampleRate;
  const newLength = Math.floor(audioData.length * ratio);
  const result = new Float32Array(newLength);
  
  // Use linear interpolation for simple resampling
  // For better quality in production, consider using a more sophisticated algorithm
  for (let i = 0; i < newLength; i++) {
    const exactPos = i / ratio;
    const index1 = Math.floor(exactPos);
    const index2 = Math.min(index1 + 1, audioData.length - 1);
    const fraction = exactPos - index1;
    
    // Linear interpolation between the two closest samples
    result[i] = audioData[index1] * (1 - fraction) + audioData[index2] * fraction;
  }
  
  return result;
}

/**
 * Apply bandpass filter to audio data
 */
function applyBandpassFilter(
  audioData: Float32Array,
  lowCutHz: number,
  highCutHz: number,
  sampleRate: number
): Float32Array {
  // Convert to tensor for TensorFlow.js processing
  const tensor = tf.tensor1d(audioData);
  
  // Apply FFT
  const fft = tf.spectral.rfft(tensor);
  // Fix the type issues by using type assertions
  const fftReal = (fft as any).real();
  const fftImag = (fft as any).imag();
  
  // Get frequency domain representation
  const frequencyBinCount = Math.floor(audioData.length / 2) + 1;
  const frequencyStep = sampleRate / audioData.length;
  
  // Create filter mask based on frequency cutoffs
  const filterMask = tf.buffer([frequencyBinCount]);
  
  for (let i = 0; i < frequencyBinCount; i++) {
    const frequency = i * frequencyStep;
    
    // Pass frequencies between lowCut and highCut
    if (frequency >= lowCutHz && frequency <= highCutHz) {
      filterMask.set(1.0, i);
    } else {
      filterMask.set(0.0, i);
    }
  }
  
  // Apply the filter
  const filterMaskTensor = filterMask.toTensor();
  const filteredReal = fftReal.mul(filterMaskTensor);
  const filteredImag = fftImag.mul(filterMaskTensor);
  
  // Convert back to time domain
  const filteredComplex = tf.complex(filteredReal, filteredImag);
  const ifft = tf.spectral.irfft(filteredComplex);
  
  // Convert back to Float32Array
  const result = ifft.dataSync() as Float32Array;
  
  // Clean up tensors
  tensor.dispose();
  fft.dispose();
  fftReal.dispose();
  fftImag.dispose();
  filterMaskTensor.dispose();
  filteredReal.dispose();
  filteredImag.dispose();
  filteredComplex.dispose();
  ifft.dispose();
  
  return result;
}

/**
 * Trim silence from the beginning and end of audio
 */
function trimSilence(audioData: Float32Array, thresholdDb: number): Float32Array {
  // Convert dB threshold to linear amplitude
  const threshold = Math.pow(10, thresholdDb / 20);
  
  // Find start index (first sample above threshold)
  let startIndex = 0;
  while (startIndex < audioData.length && Math.abs(audioData[startIndex]) < threshold) {
    startIndex++;
  }
  
  // Find end index (last sample above threshold)
  let endIndex = audioData.length - 1;
  while (endIndex > startIndex && Math.abs(audioData[endIndex]) < threshold) {
    endIndex--;
  }
  
  // If the entire audio is below the threshold, return a small section
  if (startIndex >= endIndex) {
    console.warn('Audio contains only silence below threshold');
    return new Float32Array(audioData.subarray(0, Math.min(1024, audioData.length)));
  }
  
  // Return the trimmed audio
  return new Float32Array(audioData.subarray(startIndex, endIndex + 1));
}

/**
 * Normalize audio to target peak level
 */
function normalizeAudio(audioData: Float32Array, targetPeakDb: number): Float32Array {
  // Find the maximum absolute amplitude
  let maxAmplitude = 0;
  for (let i = 0; i < audioData.length; i++) {
    maxAmplitude = Math.max(maxAmplitude, Math.abs(audioData[i]));
  }
  
  // If there's no signal, return as is
  if (maxAmplitude === 0) {
    console.warn('Cannot normalize silent audio');
    return audioData;
  }
  
  // Convert target dB to linear scale
  const targetAmplitude = Math.pow(10, targetPeakDb / 20);
  
  // Calculate the gain factor
  const gainFactor = targetAmplitude / maxAmplitude;
  
  // Apply the gain
  const normalizedData = new Float32Array(audioData.length);
  for (let i = 0; i < audioData.length; i++) {
    normalizedData[i] = audioData[i] * gainFactor;
  }
  
  return normalizedData;
}

/**
 * Split audio into frames for analysis
 */
export function splitIntoFrames(
  audioData: Float32Array,
  frameSize: number = AudioConfig.preprocessing.frameSize,
  hopSize: number = AudioConfig.preprocessing.hopSize
): Float32Array[] {
  const frames: Float32Array[] = [];
  
  // Calculate the number of frames
  const numFrames = Math.floor((audioData.length - frameSize) / hopSize) + 1;
  
  // Extract each frame
  for (let i = 0; i < numFrames; i++) {
    const startIndex = i * hopSize;
    const frame = new Float32Array(frameSize);
    
    // Copy data to frame
    for (let j = 0; j < frameSize; j++) {
      if (startIndex + j < audioData.length) {
        frame[j] = audioData[startIndex + j];
      } else {
        frame[j] = 0; // Zero padding if needed
      }
    }
    
    frames.push(frame);
  }
  
  return frames;
}

// Export individual preprocessing functions for testing/utility
export {
  convertToFloat32,
  resampleAudio,
  applyBandpassFilter,
  trimSilence,
  normalizeAudio
}; 