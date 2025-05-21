import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// This version uses our enhanced Python processor for better audio fingerprinting

export async function POST(request: Request) {
  try {
    // Get the JSON data from the request
    const data = await request.json();
    const audioBase64 = data.audio;
    const reciterName = data.name;
    
    if (!audioBase64 || !reciterName) {
      return NextResponse.json(
        { error: 'Audio data and reciter name are required' },
        { status: 400 }
      );
    }
    
    console.log(`Received reciter data for: ${reciterName}, audio length: ${audioBase64.length}`);
    
    // Initialize Supabase client
    const supabase = createClient();
    
    // Extract the base64 data part (remove the data:audio/mpeg;base64, prefix if it exists)
    const base64Data = audioBase64.includes(',') 
      ? audioBase64.split(',')[1]
      : audioBase64;
    
    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Generate filename for temporary storage
    const fileName = `reciters/${crypto.randomUUID()}.mp3`;
    
    // Upload the audio to Supabase storage for temporary access
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio')
      .upload(fileName, buffer, {
        contentType: 'audio/mpeg',
      });
      
    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json(
        { error: `Failed to upload audio: ${uploadError.message}` },
        { status: 500 }
      );
    }
    
    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('audio')
      .getPublicUrl(fileName);
      
    const publicUrl = urlData.publicUrl;
    
    // Determine recitation style
    let style = 'Hafs';
    if (reciterName.toLowerCase().includes('warsh')) {
      style = 'Warsh';
    } else if (reciterName.toLowerCase().includes('assim')) {
      style = 'Assim';
    }
    
    // Process audio using Python to extract enhanced features
    console.log('Extracting enhanced audio features using Python processor...');
    
    try {
      // Use the Python processor to extract features
      const audioFeatures = await processAudioWithPython(audioBase64);
      
      // Check if reciter already exists
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
      
      // Update or insert the reciter
      let reciterId: string;
      
      if (existingReciters && existingReciters.length > 0) {
        // Update existing reciter
        reciterId = existingReciters[0].id;
        
        const { error: updateError } = await supabase
          .from('reciters')
          .update({
            name: reciterName,
            feature_vector: audioFeatures,
            style: style
          })
          .eq('id', reciterId);
          
        if (updateError) {
          console.error(`Error updating reciter ${reciterName}:`, updateError);
          return NextResponse.json(
            { error: `Failed to update reciter: ${updateError.message}` },
            { status: 500 }
          );
        }
      } else {
        // Create new reciter
        const { data: insertData, error: insertError } = await supabase
          .from('reciters')
          .insert({
            name: reciterName,
            feature_vector: audioFeatures,
            style: style
          })
          .select();
          
        if (insertError) {
          console.error(`Error creating reciter ${reciterName}:`, insertError);
          return NextResponse.json(
            { error: `Failed to create reciter: ${insertError.message}` },
            { status: 500 }
          );
        }
        
        reciterId = insertData[0].id;
      }
      
      // Return success response with enhanced feature information
      return NextResponse.json({
        success: true,
        reciterId,
        name: reciterName,
        audio_url: publicUrl,
        style,
        features: {
          vectorEmbeddingDimension: audioFeatures.feature_vector.length,
          sequenceFeatures: audioFeatures.sequence_features ? audioFeatures.sequence_features.length : 0,
          segments: audioFeatures.segments ? audioFeatures.segments.length : 0,
          featureTypes: Object.keys(audioFeatures)
        }
      });
    } catch (processingError: any) {
      console.error('Error processing audio with Python:', processingError);
      return NextResponse.json(
        { error: `Failed to process audio: ${processingError.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error processing reciter:', error);
    return NextResponse.json(
      { error: `Failed to process reciter: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}

/**
 * Process audio data using our enhanced Python processor
 * 
 * @param audioBase64 Base64-encoded audio data
 * @returns Enhanced audio features
 */
async function processAudioWithPython(audioBase64: string): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      // Path to Python script
      const scriptPath = path.join(process.cwd(), 'lib/audio/python_processor.py');
      
      // Check if the script exists
      if (!fs.existsSync(scriptPath)) {
        reject(new Error(`Python script not found at ${scriptPath}`));
        return;
      }
      
      // Create a temporary file for the audio data if it's too large for command line
      // This avoids issues with command line length limits
      const tempInputFile = path.join(process.cwd(), 'tmp', `input-${Date.now()}.json`);
      
      // Ensure tmp directory exists
      if (!fs.existsSync(path.join(process.cwd(), 'tmp'))) {
        fs.mkdirSync(path.join(process.cwd(), 'tmp'), { recursive: true });
      }
      
      // Write audio data to temp file
      fs.writeFileSync(tempInputFile, audioBase64);
      
      // Spawn Python process
      console.log('Starting Python processor...');
      const pythonProcess = spawn('python', [
        scriptPath,
        '--process',
        '@' + tempInputFile, // @ prefix indicates to read from file
        '--audio-type',
        'audio/mpeg'
      ]);
      
      let result = '';
      let errorOutput = '';
      
      // Collect output
      pythonProcess.stdout.on('data', (data) => {
        result += data.toString();
      });
      
      // Collect errors
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.error(`Python error: ${data}`);
      });
      
      // Handle process completion
      pythonProcess.on('close', (code) => {
        // Clean up temp file
        try {
          if (fs.existsSync(tempInputFile)) {
            fs.unlinkSync(tempInputFile);
          }
        } catch (e) {
          console.error('Error removing temp file:', e);
        }
        
        if (code !== 0) {
          reject(new Error(`Python process exited with code ${code}: ${errorOutput}`));
          return;
        }
        
        try {
          // Parse the JSON output from Python
          const features = JSON.parse(result);
          resolve(features);
        } catch (jsonError: any) {
          reject(new Error(`Failed to parse Python output: ${jsonError.message}`));
        }
      });
      
      // Handle process errors
      pythonProcess.on('error', (err) => {
        // Clean up temp file
        try {
          if (fs.existsSync(tempInputFile)) {
            fs.unlinkSync(tempInputFile);
          }
        } catch (e) {
          console.error('Error removing temp file:', e);
        }
        
        reject(new Error(`Failed to start Python process: ${err.message}`));
      });
    } catch (error: any) {
      reject(new Error(`Error in processAudioWithPython: ${error.message}`));
    }
  });
} 