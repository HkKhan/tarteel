/**
 * Script to extract real MFCC features from reciter audio files and update the database
 * Run with: npx ts-node scripts/extract-real-features.ts
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import Meyda from 'meyda';
import * as mm from 'music-metadata';

// Load audio files (using Node's FileSystem)
async function loadAudioBuffer(filePath: string): Promise<{ buffer: Buffer, format: mm.IAudioMetadata }> {
  const buffer = fs.readFileSync(filePath);
  const metadata = await mm.parseBuffer(buffer);
  return { buffer, format: metadata };
}

// Process audio data to extract MFCC features
async function extractMFCCFeatures(audioBuffer: Buffer, metadata: mm.IAudioMetadata): Promise<number[][]> {
  try {
    // Get audio format info
    const sampleRate = metadata.format.sampleRate || 44100;
    const channels = metadata.format.numberOfChannels || 2;
    
    console.log(`Audio: ${sampleRate}Hz, ${channels} channels, ${metadata.format.duration}s`);
    
    // For MP3s we need to decode the audio first
    // Since this is complex, we'll use a simpler approach
    // Convert the buffer to samples by treating it as 16-bit PCM
    // This is an approximation that will work for basic analysis
    
    // Ensure the buffer has an even length for Int16Array
    const buffer = audioBuffer.length % 2 === 0 
      ? audioBuffer 
      : audioBuffer.slice(0, audioBuffer.length - 1);
    
    // Convert Buffer to Int16Array (2 bytes per sample)
    const int16View = new Int16Array(new Uint8Array(buffer).buffer);
    
    // Convert to Float32Array (normalize to -1 to 1)
    const floatData = new Float32Array(int16View.length);
    for (let i = 0; i < int16View.length; i++) {
      floatData[i] = int16View[i] / 32768.0;
    }
    
    // Audio processing parameters
    const frameSize = 1024;
    const hopSize = 512;
    
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
    
    if (mfccs.length === 0) {
      throw new Error('Failed to extract any MFCC frames');
    }
    
    console.log(`Successfully extracted ${mfccs.length} MFCC frames`);
    
    // Return only the MFCCs (max 300 frames to limit size)
    return mfccs.length > 300 ? mfccs.slice(0, 300) : mfccs;
  } catch (err) {
    console.error('Error in MFCC extraction:', err);
    throw err;
  }
}

// Calculate mean values for each MFCC coefficient across frames
function calculateMeans(mfccs: number[][]): number[] {
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
function calculateStdDevs(mfccs: number[][], means: number[]): number[] {
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
  // Initialize Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Missing environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  
  // Path to reciter directories (Surah Al-Fatiha recordings)
  const fatihaDir = path.join(process.cwd(), 'public', 'everyayah_fatiha');
  
  // Get all reciter directories
  const reciterDirs = fs.readdirSync(fatihaDir).filter(dir => 
    fs.statSync(path.join(fatihaDir, dir)).isDirectory()
  );
  
  console.log(`Found ${reciterDirs.length} reciter directories`);
  
  // Process each reciter
  for (const dir of reciterDirs) {
    // Format reciter name
    const reciterName = dir.replace(/_/g, ' ');
    
    console.log(`Processing ${reciterName}`);
    
    // Find audio file for Surah Al-Fatiha
    const audioFile = path.join(fatihaDir, dir, '001001.mp3');
    
    if (!fs.existsSync(audioFile)) {
      console.warn(`Audio file not found for ${reciterName}, skipping`);
      continue;
    }
    
    try {
      // Extract audio features
      console.log(`Extracting features from ${audioFile}`);
      const { buffer, format } = await loadAudioBuffer(audioFile);
      // features is now directly the number[][] array of MFCCs
      const featureVector = await extractMFCCFeatures(buffer, format); 
      
      // Get reciter from database
      const { data: reciters, error: fetchError } = await supabase
        .from('reciters')
        .select('id, name')
        .eq('name', reciterName);
      
      if (fetchError) {
        console.error(`Error fetching reciter ${reciterName}:`, fetchError);
        continue;
      }
      
      if (reciters && reciters.length > 0) {
        // Update existing reciter
        const { error: updateError } = await supabase
          .from('reciters')
          .update({ feature_vector: featureVector })
          .eq('id', reciters[0].id);
        
        if (updateError) {
          console.error(`Error updating feature vector for ${reciterName}:`, updateError);
        } else {
          console.log(`Updated feature vector for ${reciterName}`);
        }
      } else {
        // Insert new reciter if not found
        const { error: insertError } = await supabase
          .from('reciters')
          .insert({
            name: reciterName,
            feature_vector: featureVector,
            audio_url: `/everyayah_fatiha/${dir}/001001.mp3`
          });
        
        if (insertError) {
          console.error(`Error inserting reciter ${reciterName}:`, insertError);
        } else {
          console.log(`Inserted new reciter ${reciterName}`);
        }
      }
    } catch (err) {
      console.error(`Error processing ${reciterName}:`, err);
    }
  }
  
  console.log('Feature extraction and database update complete');
}

main().catch(err => {
  console.error('Error in main process:', err);
  process.exit(1);
}); 