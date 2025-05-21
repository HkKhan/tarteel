/**
 * Script to extract real MFCC features from reciter audio files and update the database
 * Run with: node --experimental-modules extract-real-features.js
 */

// Load environment variables from .env file
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
try {
  const dotenv = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  const lines = dotenv.split('\n');
  
  for (const line of lines) {
    // Skip empty lines or comments
    if (!line || line.trim().startsWith('#')) continue;
    
    // Split by the first equals sign
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      // Join the rest back together in case the value contains = signs
      const value = parts.slice(1).join('=').trim();
      if (key && value) {
        process.env[key] = value;
        // console.log(`Loaded env var: ${key}=${value}`);
      }
    }
  }
  console.log('Loaded environment variables from .env file');
} catch (error) {
  console.warn('Failed to load .env file:', error.message);
}

const { createClient } = require('@supabase/supabase-js');
const Meyda = require('meyda');
// We'll use dynamic import for music-metadata
// This function will be used to dynamically import music-metadata when needed
async function parseAudioMetadata(buffer) {
  try {
    // Import music-metadata dynamically
    const { parseBuffer } = await import('music-metadata');
    return await parseBuffer(buffer);
  } catch (error) {
    console.error('Error importing or using music-metadata:', error);
    throw error;
  }
}

// Type definitions for easier conversion
/**
 * @typedef {Object} AudioMetadata
 * @property {Object} format
 * @property {number} [format.sampleRate]
 * @property {number} [format.numberOfChannels]
 * @property {number} [format.duration]
 */

/**
 * @param {string} filePath
 * @returns {Promise<{buffer: Buffer, format: AudioMetadata}>}
 */
async function loadAudioBuffer(filePath) {
  const buffer = fs.readFileSync(filePath);
  const metadata = await parseAudioMetadata(buffer);
  return { buffer, format: metadata };
}

/**
 * Helper function to convert an audio buffer to a mono Float32Array
 * @param {Buffer} audioBuffer 
 * @param {AudioMetadata} metadata 
 * @returns {Promise<Float32Array>}
 */
async function convertAudioBufferToFloat32Array(audioBuffer, metadata) {
  console.log('[convertAudioBufferToFloat32Array] Started.');
  // Ensure the buffer has an even length for Int16Array processing if needed,
  // though for MP3s, the structure is more complex than raw PCM.
  // This part assumes the buffer can be naively interpreted, which is an approximation.
  const bufferForInt16 = audioBuffer.length % 2 === 0
    ? audioBuffer
    : audioBuffer.slice(0, audioBuffer.length - 1);

  // Convert Buffer to Int16Array (2 bytes per sample)
  // This step is a significant approximation for MP3s, as it bypasses proper decoding.
  const int16View = new Int16Array(new Uint8Array(bufferForInt16).buffer);
  
  const numberOfChannels = metadata.format.numberOfChannels || 1;
  const samplesPerChannel = Math.floor(int16View.length / numberOfChannels);
  
  console.log(`[convertAudioBufferToFloat32Array] Audio properties: ${metadata.format.sampleRate}Hz, ${numberOfChannels} channels.`);
  
  const floatData = new Float32Array(samplesPerChannel);

  if (numberOfChannels === 1) {
    for (let i = 0; i < samplesPerChannel; i++) {
      floatData[i] = int16View[i] / 32768.0; // Normalize to -1.0 to 1.0
    }
  } else { // For stereo or more channels, average them to mono
    for (let i = 0; i < samplesPerChannel; i++) {
      let sum = 0;
      for (let ch = 0; ch < numberOfChannels; ch++) {
        sum += int16View[i * numberOfChannels + ch];
      }
      floatData[i] = (sum / numberOfChannels) / 32768.0; // Normalize
    }
    console.log(`[convertAudioBufferToFloat32Array] Converted ${numberOfChannels}-channel audio to mono by averaging channels. Output samples: ${floatData.length}`);
  }
  console.log('[convertAudioBufferToFloat32Array] Finished.');
  return floatData;
}

/**
 * Core reusable MFCC extraction logic from a Float32Array
 * @param {Float32Array} concatenatedFloatData 
 * @param {number} sampleRate 
 * @returns {Promise<number[][]>}
 */
async function extractMFCCFromFloat32Array(concatenatedFloatData, sampleRate) {
  console.log(`[extractMFCCFromFloat32Array] Started. Sample rate: ${sampleRate}, Total samples: ${concatenatedFloatData.length}`);
  try {
    console.log(`Processing audio: ${sampleRate}Hz, total samples: ${concatenatedFloatData.length}`);

    const frameSize = 1024; // Meyda's default bufferSize
    const hopSize = 512;    // Common hop size (half of frameSize)

    // Configure Meyda
    // Meyda needs a sampleRate; this is how you provide it in Node without a full Web Audio API
    Meyda.audioContext = { sampleRate };
    Meyda.bufferSize = frameSize;
    Meyda.numberOfMFCCCoefficients = 13;
    // Meyda.hopSize is not a direct setting for extract, manual iteration handles hops.

    const mfccs = [];
    // Calculate total frames based on hop size
    const frameCount = Math.floor((concatenatedFloatData.length - frameSize) / hopSize) + 1;
    
    console.log(`[extractMFCCFromFloat32Array] Processing ${frameCount} frames of audio data for MFCC extraction.`);
    
    for (let i = 0; i < frameCount; i++) {
      const startIndex = i * hopSize;
      const frameBuffer = concatenatedFloatData.slice(startIndex, startIndex + frameSize);
      
      let currentFrame = frameBuffer;
      // Pad with zeros if the frame is smaller than frameSize (typically the last frame)
      if (frameBuffer.length < frameSize) {
        currentFrame = new Float32Array(frameSize); // Create a zero-filled Float32Array
        currentFrame.set(frameBuffer); // Copy data from frameBuffer to the beginning
      }
      
      try {
        const features = Meyda.extract(["mfcc"], currentFrame);
        if (features && Array.isArray(features.mfcc) && features.mfcc.every(val => !isNaN(val))) {
          mfccs.push(features.mfcc);
        } else if (features && features.mfcc && features.mfcc.some(isNaN)) {
          console.warn(`[extractMFCCFromFloat32Array] Frame ${i} produced NaN MFCCs, skipping.`);
        }
      } catch (err) {
        console.error(`[extractMFCCFromFloat32Array] Error extracting features from frame ${i}:`, err);
      }
    }
    
    if (mfccs.length === 0) {
      console.warn('Failed to extract any valid MFCC frames. This might be due to very short audio or processing issues.');
      // Return empty array or handle as error, depending on requirements.
      // For now, let's allow returning empty if no frames are good.
      // throw new Error('Failed to extract any MFCC frames');
    }
    
    console.log(`[extractMFCCFromFloat32Array] Successfully extracted ${mfccs.length} MFCC frames.`);
    
    // Return only the MFCCs (max 300 frames to limit size)
    const result = mfccs.length > 300 ? mfccs.slice(0, 300) : mfccs;
    console.log(`[extractMFCCFromFloat32Array] Finished. Returning ${result.length} frames.`);
    return result;
  } catch (err) {
    console.error('[extractMFCCFromFloat32Array] Error in MFCC extraction from Float32Array:', err);
    throw err; // Re-throw to be caught by the caller
  }
}

/**
 * Function to load, convert, and concatenate all 7 ayahs of Fatiha for a reciter
 * @param {string} reciterAudioDir 
 * @returns {Promise<number[][]|null>}
 */
async function getConcatenatedFatihaAudioFeatures(reciterAudioDir) {
  console.log(`[getConcatenatedFatihaAudioFeatures] Started for directory: ${reciterAudioDir}`);
  const ayahFloatDataParts = [];
  let firstAyahMetadata = null;
  let totalSamples = 0;
  let actualAyahsProcessed = 0;

  console.log(`[getConcatenatedFatihaAudioFeatures] Processing reciter directory: ${reciterAudioDir}`);

  for (let i = 1; i <= 7; i++) {
    const ayahFileName = `00100${i}.mp3`;
    const audioFilePath = path.join(reciterAudioDir, ayahFileName);

    if (!fs.existsSync(audioFilePath)) {
      console.warn(`[getConcatenatedFatihaAudioFeatures] Ayah file not found: ${audioFilePath}. Skipping this ayah.`);
      continue; // Skip this ayah, but try to process the reciter with available ayahs
    }

    try {
      console.log(`[getConcatenatedFatihaAudioFeatures] Processing ${audioFilePath}`);
      const audioBuffer = fs.readFileSync(audioFilePath);
      console.log(`[getConcatenatedFatihaAudioFeatures] Read ${audioFilePath}, buffer length: ${audioBuffer.length}`);
      const metadata = await parseAudioMetadata(audioBuffer);
      console.log(`[getConcatenatedFatihaAudioFeatures] Parsed metadata for ${audioFilePath}: SR=${metadata.format.sampleRate}, Channels=${metadata.format.numberOfChannels}, Duration=${metadata.format.duration}s`);

      if (!metadata.format.sampleRate) {
        console.warn(`[getConcatenatedFatihaAudioFeatures] Missing sample rate for ${audioFilePath}, skipping this ayah.`);
        continue;
      }

      if (!firstAyahMetadata) {
        firstAyahMetadata = metadata;
      } else {
        if (firstAyahMetadata.format.sampleRate !== metadata.format.sampleRate) {
            console.warn(`[getConcatenatedFatihaAudioFeatures] Sample rate mismatch in ${reciterAudioDir}. Ayah ${ayahFileName} has ${metadata.format.sampleRate}Hz vs first ayah's ${firstAyahMetadata.format.sampleRate}Hz. Sticking to first ayah's rate for consistency.`);
        }
        if (firstAyahMetadata.format.numberOfChannels !== metadata.format.numberOfChannels) {
            console.log(`Channel count mismatch for ${ayahFileName}. This is handled by mono conversion.`);
        }
      }
      
      const floatData = await convertAudioBufferToFloat32Array(audioBuffer, metadata);
      console.log(`[getConcatenatedFatihaAudioFeatures] Converted ${audioFilePath} to Float32Array, length: ${floatData.length}`);
      if (floatData.length > 0) {
        ayahFloatDataParts.push(floatData);
        totalSamples += floatData.length;
        actualAyahsProcessed++;
      } else {
        console.warn(`[getConcatenatedFatihaAudioFeatures] Processed floatData for ${audioFilePath} is empty, skipping.`);
      }

    } catch (error) {
      console.error(`[getConcatenatedFatihaAudioFeatures] Error processing ayah ${audioFilePath}:`, error);
      // Optionally decide if one failed ayah should stop processing for the reciter
      // For now, we continue with other ayahs
    }
  }

  if (ayahFloatDataParts.length === 0 || !firstAyahMetadata || actualAyahsProcessed === 0) {
    console.warn(`[getConcatenatedFatihaAudioFeatures] No valid audio data processed for reciter in ${reciterAudioDir}. Skipping this reciter.`);
    console.log(`[getConcatenatedFatihaAudioFeatures] Finished early due to no valid audio data.`);
    return null;
  }
  
  console.log(`[getConcatenatedFatihaAudioFeatures] Processed ${actualAyahsProcessed} ayahs for ${reciterAudioDir}. Total samples: ${totalSamples}`);

  // Concatenate all Float32Array parts
  const concatenatedFloatData = new Float32Array(totalSamples);
  let offset = 0;
  for (const part of ayahFloatDataParts) {
    concatenatedFloatData.set(part, offset);
    offset += part.length;
  }
  
  // Use sample rate from the first successfully processed ayah's metadata
  const sampleRate = firstAyahMetadata.format.sampleRate; 

  if (concatenatedFloatData.length < 1024) { // Ensure there's enough data for at least one frame
      console.warn(`[getConcatenatedFatihaAudioFeatures] Concatenated audio data for ${reciterAudioDir} is too short (${concatenatedFloatData.length} samples). Skipping MFCC extraction.`);
      console.log(`[getConcatenatedFatihaAudioFeatures] Finished. Returning empty array due to short audio.`);
      return []; // Return empty array, as no features can be extracted.
  }

  console.log(`[getConcatenatedFatihaAudioFeatures] Calling extractMFCCFromFloat32Array for ${reciterAudioDir}`);
  const features = await extractMFCCFromFloat32Array(concatenatedFloatData, sampleRate);
  console.log(`[getConcatenatedFatihaAudioFeatures] Finished for ${reciterAudioDir}. Extracted ${features ? features.length : 'null'} MFCC frames.`);
  return features;
}

/**
 * Calculate mean values for each MFCC coefficient across frames
 * @param {number[][]} mfccs 
 * @returns {number[]}
 */
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

/**
 * Calculate standard deviation for each MFCC coefficient across frames
 * @param {number[][]} mfccs 
 * @param {number[]} means 
 * @returns {number[]}
 */
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

async function main() {
  console.log('[main] Script started.');
  // Initialize Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('[main] Missing environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  console.log('[main] Supabase environment variables found.');

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  console.log('[main] Supabase client initialized.');
  
  // Path to reciter directories (Surah Al-Fatiha recordings)
  const fatihaDir = path.join(process.cwd(), '..', 'public', 'everyayah_fatiha');
  
  // Get all reciter directories
  const reciterDirs = fs.readdirSync(fatihaDir).filter(dir => 
    fs.statSync(path.join(fatihaDir, dir)).isDirectory()
  );
  
  console.log(`[main] Found ${reciterDirs.length} reciter directories in ${fatihaDir}`);
  
  // Process each reciter
  for (const dir of reciterDirs) {
    // Format reciter name
    const reciterName = dir.replace(/_/g, ' ');
    
    console.log(`[main] Processing reciter: ${reciterName} (from directory: ${dir})`);
    
    const reciterAudioDirPath = path.join(fatihaDir, dir);

    try {
      // Extract concatenated audio features for all 7 ayahs
      console.log(`[main] Extracting Fatiha features for ${reciterName} from directory ${reciterAudioDirPath}`);
      const featureVector = await getConcatenatedFatihaAudioFeatures(reciterAudioDirPath); 
      
      if (!featureVector) {
        console.warn(`[main] No feature vector could be extracted for ${reciterName}, skipping database update.`);
        continue;
      }
      if (featureVector.length === 0) {
        console.warn(`[main] Extracted feature vector for ${reciterName} is empty (e.g. audio too short, or all frames failed). Skipping database update.`);
        continue;
      }
      
      console.log(`[main] Successfully extracted ${featureVector.length} MFCC frames for ${reciterName}.`);

      // Get reciter from database
      console.log(`[main] Fetching reciter '${reciterName}' from database.`);
      const { data: reciters, error: fetchError } = await supabase
        .from('reciters')
        .select('id, name')
        .eq('name', reciterName);
      
      if (fetchError) {
        console.error(`[main] Error fetching reciter ${reciterName}:`, fetchError);
        continue;
      }
      
      console.log(`[main] Fetched reciters for '${reciterName}':`, reciters);

      // Determine style based on reciter name
      const style = reciterName.toLowerCase().includes('warsh') ? 'warsh' : 'hafs and assim';
      console.log(`[main] Determined style for ${reciterName}: ${style}`);

      if (reciters && reciters.length > 0) {
        // Update existing reciter
        console.log(`[main] Updating feature vector for existing reciter ${reciterName} (ID: ${reciters[0].id})`);
        const { error: updateError } = await supabase
          .from('reciters')
          .update({ 
            feature_vector: featureVector,
            style: style 
          })
          .eq('id', reciters[0].id);
        
        if (updateError) {
          console.error(`[main] Error updating feature vector for ${reciterName}:`, updateError);
        } else {
          console.log(`[main] Updated feature vector for ${reciterName}`);
        }
      } else {
        // Insert new reciter if not found
        console.log(`[main] Reciter ${reciterName} not found. Inserting new reciter.`);
        const { error: insertError } = await supabase
          .from('reciters')
          .insert({
            name: reciterName,
            feature_vector: featureVector,
            style: style
          });
        
        if (insertError) {
          console.error(`[main] Error inserting reciter ${reciterName}:`, insertError);
        } else {
          console.log(`[main] Inserted new reciter ${reciterName}`);
        }
      }
    } catch (err) {
      console.error(`[main] Error processing reciter ${reciterName} (directory: ${dir}):`, err);
    }
  }
  
  console.log('[main] Feature extraction and database update complete.');
  console.log('[main] Script finished.');
}

main().catch(err => {
  console.error('[main] Error in main process:', err);
  process.exit(1);
}); 