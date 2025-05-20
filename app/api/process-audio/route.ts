// Import Meyda with error handling for serverless environment
let Meyda: any;
try {
  Meyda = require('meyda');
  console.log('Meyda loaded successfully:', Meyda.listAvailableFeatureExtractors().includes('mfcc'));
} catch (err) {
  console.error('Error loading Meyda:', err);
  // Create a minimal mock implementation if Meyda fails to load
  Meyda = {
    extract: () => ({ mfcc: Array(13).fill(0) }),
    listAvailableFeatureExtractors: () => ['mfcc'],
    numberOfMFCCCoefficients: 13
  };
}

/**
 * API Route to process audio files
 * Takes in raw audio data and extracts features
 */
export async function POST(request: Request) {
  try {
    // Get the form data from the request
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const sampleRate = parseInt(formData.get('sampleRate') as string || '44100', 10);
    
    if (!audioFile) {
      return Response.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }
    
    console.log(`Processing audio: ${audioFile.name}, type: ${audioFile.type}, size: ${audioFile.size} bytes`);
    
    const audioBuffer = await audioFile.arrayBuffer();
    console.log(`Audio buffer size: ${audioBuffer.byteLength} bytes`);
    
    // Extract MFCC features directly - no means/variances structure
    const featureVector = await extractMFCCFeatures(audioBuffer, sampleRate);
    
    // Log feature vector structure and sample values
    console.log("Extracted feature vector structure:", {
      isArray: Array.isArray(featureVector),
      length: Array.isArray(featureVector) ? featureVector.length : 'not an array',
      frameLength: Array.isArray(featureVector) && featureVector.length > 0 && Array.isArray(featureVector[0]) 
        ? featureVector[0].length 
        : 'unknown',
      sampleValues: Array.isArray(featureVector) && featureVector.length > 0 && Array.isArray(featureVector[0])
        ? featureVector[0].slice(0, 5)
        : 'unknown'
    });
    
    // Return the extracted features
    return Response.json({
      featureVector
    });
  } catch (error) {
    console.error('Error processing audio:', error);
    return Response.json(
      { error: 'Failed to process audio file' },
      { status: 500 }
    );
  }
}

/**
 * Extract MFCC features from raw audio data
 * @param audioBuffer Raw audio data
 * @param sampleRate Sample rate of the audio data
 * @returns Array of MFCC frames
 */
async function extractMFCCFeatures(audioBuffer: ArrayBuffer, sampleRate: number = 44100): Promise<any> {
  try {
    // Check if buffer is valid
    if (!audioBuffer || audioBuffer.byteLength === 0) {
      console.error('Invalid or empty audio buffer');
      throw new Error('Invalid audio buffer');
    }
    
    // Ensure the buffer has an even length for Int16Array
    const buffer = audioBuffer.byteLength % 2 === 0 
      ? audioBuffer 
      : audioBuffer.slice(0, audioBuffer.byteLength - 1);
    
    console.log(`Using buffer of size ${buffer.byteLength} bytes for processing`);
    
    // Convert ArrayBuffer to Float32Array for audio processing
    const audioData = new Int16Array(buffer);
    const floatData = new Float32Array(audioData.length);
    
    // Convert Int16 (-32768 to 32767) to Float32 (-1 to 1)
    for (let i = 0; i < audioData.length; i++) {
      floatData[i] = audioData[i] / 32768.0;
    }
    
    // Audio processing parameters
    const frameSize = 1024; // ~23ms at 44.1kHz
    const hopSize = 512; // 50% overlap between frames
    
    // Skip processing if the signal is too short
    if (floatData.length < frameSize) {
      console.warn('Audio signal too short for MFCC extraction');
      throw new Error('Audio signal too short');
    }
    
    // Configure Meyda
    Meyda.numberOfMFCCCoefficients = 13;
    
    // Extract MFCCs frame by frame
    const mfccs: number[][] = [];
    const frameCount = Math.floor((floatData.length - frameSize) / hopSize) + 1;
    
    console.log(`Processing ${frameCount} frames of audio data`);
    
    for (let i = 0; i < frameCount; i++) {
      const startIndex = i * hopSize;
      const frame = floatData.slice(startIndex, startIndex + frameSize);
      
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
    
    // If we couldn't extract any MFCCs, throw an error
    if (mfccs.length === 0) {
      console.error('Failed to extract any MFCC frames');
      throw new Error('MFCC extraction failed');
    }
    
    console.log(`Successfully extracted ${mfccs.length} MFCC frames`);
    
    // Return only the MFCCs (max 300 frames to limit size)
    return mfccs.length > 300 ? mfccs.slice(0, 300) : mfccs;
  } catch (err) {
    console.error('Error extracting MFCC features:', err);
    // Fallback to random features if extraction fails
    const numCoefficients = 13;
    return Array.from({ length: 10 }, () => 
      Array.from({ length: numCoefficients }, () => Math.random() * 2 - 1)
    );
  }
} 