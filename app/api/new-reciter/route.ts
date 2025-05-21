import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { extractAudioFeatures } from "@/lib/audio/processor";
import { storeFeatureVector } from "@/lib/supabase/vectorStore";

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

export async function POST(request: Request) {
  try {
    // Get the form data from the request
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const reciterName = formData.get('name') as string;
    const sampleRate = parseInt(formData.get('sampleRate') as string || '44100', 10);
    
    if (!audioFile || !reciterName) {
      return NextResponse.json(
        { error: 'Audio file and reciter name are required' },
        { status: 400 }
      );
    }
    
    console.log(`Processing reciter: ${reciterName}, audio: ${audioFile.name}, type: ${audioFile.type}, size: ${audioFile.size} bytes`);
    
    // Initialize Supabase client
    const supabase = createClient();
    
    // 1. Upload the audio file to Supabase Storage
    const fileName = `reciters/${crypto.randomUUID()}.mp3`;
    const audioBuffer = await audioFile.arrayBuffer();
    
    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("audio")
      .upload(fileName, audioFile, {
        contentType: "audio/mpeg",
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError.message);
      return NextResponse.json(
        { error: `Failed to upload audio: ${uploadError.message}` },
        { status: 500 }
      );
    }
    
    // Get the public URL for the uploaded file
    const { data: urlData } = supabase.storage.from("audio").getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;
    
    // 2. Extract audio features using the new pipeline
    console.log(`Extracting features from audio buffer of size: ${audioBuffer.byteLength} bytes`);
    
    // Process audio using the new feature extraction pipeline with timeout
    let features: Awaited<ReturnType<typeof extractAudioFeatures>>;
    try {
      // Create a promise that will resolve with the features or reject after timeout
      const featureExtractionPromise = extractAudioFeatures(audioBuffer);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Audio processing timed out after 180 seconds')), 180000);
      });
      
      // Race the promises
      features = await Promise.race([featureExtractionPromise, timeoutPromise]);
      console.log('Feature extraction completed successfully');
    } catch (featureError: any) {
      console.error('Error during feature extraction:', featureError);
      
      // Delete the uploaded file since we couldn't process it
      await supabase.storage.from("audio").remove([fileName]);
      
      return NextResponse.json(
        { error: `Failed to process audio: ${featureError.message || 'Unknown error during feature extraction'}. Please try with a shorter audio clip or contact support.` },
        { status: 500 }
      );
    }
    
    // 3. Determine recitation style based on name
    const style = reciterName.toLowerCase().includes('warsh') ? 'Warsh' : 'Hafs';
    
    // 4. Insert/update the reciter in the database
    const { data: existingReciters, error: checkError } = await supabase
      .from('reciters')
      .select('id, name')
      .eq('name', reciterName);
    
    if (checkError) {
      console.error(`Error checking reciter ${reciterName}:`, checkError);
      return NextResponse.json(
        { error: `Failed to check existing reciter: ${checkError.message}` },
        { status: 500 }
      );
    }
    
    // Get a sample record to check what fields exist
    const { data: sampleReciters } = await supabase
      .from('reciters')
      .select('*')
      .limit(1);
      
    // Extract column names from sample
    const availableColumns = sampleReciters && sampleReciters.length > 0 
      ? Object.keys(sampleReciters[0]) 
      : ['name', 'feature_vector']; // Fallback to minimal required fields
    
    console.log('Available columns in reciters table:', availableColumns);
    
    // Build payload with only available columns
    const basePayload: Record<string, any> = {
      name: reciterName,
      feature_vector: features.vectorEmbedding // Use the new vector embedding
    };
    
    // Add optional fields if they exist in the schema
    if (availableColumns.includes('sample_audio_url')) {
      basePayload.sample_audio_url = publicUrl;
    }
    
    if (availableColumns.includes('style')) {
      basePayload.style = style;
    }
    
    // Log the payload we're using
    console.log('Using payload for database operation:', basePayload);
    
    let reciterId: string;
    
    if (existingReciters && existingReciters.length > 0) {
      // Update existing reciter
      reciterId = existingReciters[0].id;
      
      const { error: updateError } = await supabase
        .from('reciters')
        .update(basePayload)
        .eq('id', reciterId);
      
      if (updateError) {
        console.error(`Error updating reciter ${reciterName}:`, updateError);
        return NextResponse.json(
          { error: `Failed to update reciter: ${updateError.message}` },
          { status: 500 }
        );
      }
      
      // Store feature vector using the vector store
      await storeFeatureVector(reciterId, features.vectorEmbedding);
    } else {
      // Create new reciter
      const { data: insertData, error: insertError } = await supabase
        .from('reciters')
        .insert(basePayload)
        .select();
      
      if (insertError) {
        console.error(`Error creating reciter ${reciterName}:`, insertError);
        return NextResponse.json(
          { error: `Failed to create reciter: ${insertError.message}` },
          { status: 500 }
        );
      }
      
      reciterId = insertData[0].id;
      
      // Store feature vector using the vector store
      await storeFeatureVector(reciterId, features.vectorEmbedding);
    }
    
    return NextResponse.json({
      success: true,
      reciterId,
      name: reciterName,
      audio_url: publicUrl,
      style,
      features: {
        mfccCount: features.mfcc.length,
        chromaCount: features.chroma.length,
        melSpectrogramSize: features.melSpectrogram.length,
        vectorEmbeddingDimension: features.vectorEmbedding.length
      }
    });
  } catch (error) {
    console.error('Error processing reciter:', error);
    return NextResponse.json(
      { error: 'Failed to process reciter' },
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