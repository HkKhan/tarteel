/**
 * Script to generate and store feature vectors for all reciters in the database
 * Run with: npx ts-node scripts/generate-feature-vectors.ts
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

// Supabase client initialization with admin privileges
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing environment variables. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceRoleKey);

// Define core reciter styles with characteristic MFCC-like patterns
const RECITER_STYLES = {
  'Egyptian_Murattal': {
    base: [0.2, -0.3, 0.15, -0.1, 0.4, 0.1, -0.2, 0.1, 0.3, -0.1, 0.2, -0.3, 0.1],
    variances: [0.05, 0.1, 0.08, 0.07, 0.12, 0.05, 0.09, 0.07, 0.11, 0.06, 0.08, 0.1, 0.07]
  },
  'Egyptian_Mujawwad': {
    base: [0.4, -0.5, 0.3, -0.25, 0.6, 0.2, -0.35, 0.15, 0.45, -0.2, 0.4, -0.45, 0.25],
    variances: [0.12, 0.18, 0.15, 0.13, 0.2, 0.11, 0.16, 0.14, 0.19, 0.12, 0.15, 0.18, 0.13]
  },
  'Saudi_Murattal': {
    base: [0.1, -0.2, 0.1, -0.05, 0.3, 0.05, -0.15, 0.08, 0.25, -0.08, 0.15, -0.2, 0.05],
    variances: [0.04, 0.09, 0.06, 0.05, 0.1, 0.04, 0.07, 0.05, 0.09, 0.05, 0.06, 0.08, 0.05]
  },
  'Levantine': {
    base: [0.25, -0.35, 0.2, -0.15, 0.45, 0.15, -0.25, 0.12, 0.35, -0.15, 0.25, -0.35, 0.15],
    variances: [0.07, 0.12, 0.09, 0.08, 0.14, 0.07, 0.11, 0.08, 0.13, 0.07, 0.09, 0.12, 0.08]
  },
  'Indonesian': {
    base: [0.15, -0.25, 0.12, -0.08, 0.35, 0.08, -0.18, 0.09, 0.28, -0.1, 0.18, -0.28, 0.08],
    variances: [0.06, 0.1, 0.07, 0.06, 0.11, 0.05, 0.08, 0.06, 0.1, 0.06, 0.07, 0.1, 0.06]
  },
  'Maghrebi': {
    base: [0.3, -0.4, 0.25, -0.2, 0.5, 0.18, -0.3, 0.14, 0.4, -0.18, 0.3, -0.4, 0.2],
    variances: [0.08, 0.14, 0.11, 0.09, 0.16, 0.08, 0.12, 0.09, 0.15, 0.08, 0.11, 0.14, 0.09]
  },
  'Turkish': {
    base: [0.2, -0.3, 0.18, -0.12, 0.42, 0.12, -0.22, 0.11, 0.32, -0.12, 0.22, -0.32, 0.12],
    variances: [0.07, 0.11, 0.08, 0.07, 0.13, 0.06, 0.09, 0.07, 0.12, 0.07, 0.08, 0.11, 0.07]
  }
};

/**
 * Generate a feature vector based on reciter style and name
 * Creates more meaningful data than purely random values
 */
function generateFeatureVector(reciterName: string, recitationStyle: string): { means: number[]; variances: number[] } {
  // Determine the base style to use
  let baseStyle = 'Egyptian_Murattal'; // default
  
  if (recitationStyle) {
    const styleLower = recitationStyle.toLowerCase();
    
    if (styleLower.includes('egyptian') && styleLower.includes('mujawwad')) {
      baseStyle = 'Egyptian_Mujawwad';
    } else if (styleLower.includes('egyptian')) {
      baseStyle = 'Egyptian_Murattal';
    } else if (styleLower.includes('saudi')) {
      baseStyle = 'Saudi_Murattal';
    } else if (styleLower.includes('levant') || styleLower.includes('sham')) {
      baseStyle = 'Levantine';
    } else if (styleLower.includes('indones')) {
      baseStyle = 'Indonesian';
    } else if (styleLower.includes('maghreb') || styleLower.includes('morocc') || 
              styleLower.includes('alger') || styleLower.includes('tunis')) {
      baseStyle = 'Maghrebi';
    } else if (styleLower.includes('turk')) {
      baseStyle = 'Turkish';
    }
  }
  
  // Get the base pattern for the style
  const basePattern = RECITER_STYLES[baseStyle as keyof typeof RECITER_STYLES];
  
  // Apply some randomization to create unique features for the reciter
  // while still maintaining the characteristic patterns of the style
  const means = basePattern.base.map(base => base + (Math.random() * 0.2 - 0.1));
  const variances = basePattern.variances.map(base => base + (Math.random() * 0.05 - 0.025));
  
  return { means, variances };
}

async function main() {
  try {
    // Get all reciters
    const { data: reciters, error } = await supabase
      .from('reciters')
      .select('id, name, recitation_style');

    if (error) {
      throw error;
    }

    console.log(`Found ${reciters?.length || 0} reciters`);

    // Generate and update feature vectors for each reciter
    for (const reciter of reciters || []) {
      console.log(`Generating feature vector for ${reciter.name}`);
      
      // Generate a feature vector based on reciter style
      const featureVector = generateFeatureVector(
        reciter.name,
        reciter.recitation_style || ''
      );
      
      // Update the reciter with the feature vector
      const { error: updateError } = await supabase
        .from('reciters')
        .update({ feature_vector: featureVector })
        .eq('id', reciter.id);
      
      if (updateError) {
        console.error(`Error updating ${reciter.name}:`, updateError);
      } else {
        console.log(`Updated ${reciter.name} successfully`);
      }
    }
    
    console.log('Feature vector generation complete');
  } catch (error) {
    console.error('Error generating feature vectors:', error);
    process.exit(1);
  }
}

// Execute the script
main(); 