/**
 * Script to import all reciters from the public/everyayah_fatiha directory
 * This script:
 * 1. Reads all reciter directories
 * 2. Creates database entries for each reciter
 * 3. Generates feature vectors for each
 * 
 * Run with: npx ts-node scripts/import-reciters.ts
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';
import dotenv from 'dotenv';

dotenv.config();

// Supabase client initialization with admin privileges
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing environment variables. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceRoleKey);

/**
 * Clean up reciter name from directory name
 */
function formatReciterName(dirName: string): string {
  return dirName
    .replace(/_/g, ' ')
    .replace(/64kbps|128kbps|192kbps/g, '')
    .replace(/QuranExplorer\.Com|ketaballah\.net/g, '')
    .replace(/warsh_warsh/g, 'Warsh')
    .replace(/Murattal/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate a feature vector for a reciter
 * In a real implementation, this would process actual audio samples
 */
function generateFeatureVector() {
  const numCoefficients = 13;
  return {
    means: Array.from({ length: numCoefficients }, () => Math.random() * 2 - 1),
    variances: Array.from({ length: numCoefficients }, () => Math.random() * 0.5)
  };
}

async function main() {
  try {
    // Path to reciter directories
    const fatihaDir = path.join(process.cwd(), 'public', 'everyayah_fatiha');
    
    // Get all reciter directories
    const reciterDirs = fs.readdirSync(fatihaDir).filter(dir => 
      fs.statSync(path.join(fatihaDir, dir)).isDirectory()
    );
    
    console.log(`Found ${reciterDirs.length} reciter directories`);
    
    // Process each reciter
    for (const dir of reciterDirs) {
      // Format reciter name
      const reciterName = formatReciterName(dir);
      
      console.log(`Processing ${reciterName}`);
      
      // Check if reciter already exists
      const { data: existingReciters, error: checkError } = await supabase
        .from('reciters')
        .select('id, name')
        .eq('name', reciterName);
      
      if (checkError) {
        console.error(`Error checking reciter ${reciterName}:`, checkError);
        continue;
      }
      
      // Determine sample audio path
      const sampleAudioPath = `/everyayah_fatiha/${dir}/001001.mp3`;
      const fullSamplePath = path.join(process.cwd(), 'public', sampleAudioPath);
      
      // Check if the sample file exists
      const sampleExists = fs.existsSync(fullSamplePath);
      const audioUrl = sampleExists ? sampleAudioPath : null;
      
      if (!sampleExists) {
        console.warn(`Sample audio not found for ${reciterName}`);
      }
      
      // Generate feature vector
      const featureVector = generateFeatureVector();
      
      if (existingReciters && existingReciters.length > 0) {
        // Update existing reciter
        const reciterId = existingReciters[0].id;
        console.log(`Updating existing reciter: ${reciterName}`);
        
        const { error: updateError } = await supabase
          .from('reciters')
          .update({
            sample_audio_url: audioUrl,
            feature_vector: featureVector
          })
          .eq('id', reciterId);
        
        if (updateError) {
          console.error(`Error updating reciter ${reciterName}:`, updateError);
        } else {
          console.log(`Updated ${reciterName} successfully`);
        }
      } else {
        // Create new reciter
        console.log(`Creating new reciter: ${reciterName}`);
        
        const { error: insertError } = await supabase
          .from('reciters')
          .insert({
            name: reciterName,
            bio: `Classical Quran reciter.`,
            era: 'Classical',
            style: 'Traditional',
            sample_audio_url: audioUrl,
            feature_vector: featureVector
          });
        
        if (insertError) {
          console.error(`Error creating reciter ${reciterName}:`, insertError);
        } else {
          console.log(`Created ${reciterName} successfully`);
        }
      }
    }
    
    console.log('Reciter import complete');
  } catch (error) {
    console.error('Error importing reciters:', error);
    process.exit(1);
  }
}

// Run the script
main(); 