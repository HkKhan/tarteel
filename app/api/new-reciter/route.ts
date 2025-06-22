import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    // Get the form data from the request
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const reciterName = formData.get('name') as string;
    
    if (!audioFile || !reciterName) {
      return NextResponse.json(
        { error: 'Audio file and reciter name are required' },
        { status: 400 }
      );
    }
    
    console.log(`Processing reciter: ${reciterName}, audio: ${audioFile.name}, type: ${audioFile.type}, size: ${audioFile.size} bytes`);
    
    // Convert audio to base64 for speaker prediction
    const audioBuffer = await audioFile.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');
    
    // Use the new speaker prediction API
    const predictionResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/predict-speaker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio: audioBase64,
        format: audioFile.type?.split('/')[1] || 'mp3',
        top_k: 3
      })
    });
    
    if (!predictionResponse.ok) {
      throw new Error('Speaker prediction failed');
    }
    
    const predictionData = await predictionResponse.json();
    
    // Store the reciter in Supabase
    const supabase = createClient();
    
    // Check if reciter already exists
    const { data: existingReciter, error: checkError } = await supabase
      .from('reciters')
      .select('id')
      .eq('name', reciterName)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') {
      throw new Error(`Database error: ${checkError.message}`);
    }
    
    if (existingReciter) {
      return NextResponse.json(
        { error: 'Reciter with this name already exists' },
        { status: 400 }
      );
    }
    
    // Store audio file in Supabase Storage
    const audioFileName = `${crypto.randomUUID()}.${audioFile.type?.split('/')[1] || 'mp3'}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio')
      .upload(audioFileName, audioBuffer, {
        contentType: audioFile.type
      });
    
    if (uploadError) {
      throw new Error(`Failed to upload audio: ${uploadError.message}`);
    }
    
    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('audio')
      .getPublicUrl(audioFileName);
    
    // Insert reciter into database
    const { data: reciterData, error: insertError } = await supabase
      .from('reciters')
      .insert({
        name: reciterName,
        style: predictionData.predictions?.[0]?.speaker || 'Unknown',
        sample_audio_url: publicUrl,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (insertError) {
      throw new Error(`Failed to create reciter: ${insertError.message}`);
    }
    
    return NextResponse.json({
      success: true,
      reciterId: reciterData.id,
      name: reciterName,
      audio_url: publicUrl,
      style: reciterData.style,
      predictions: predictionData.predictions,
      processing_time: predictionData.processing_time
    });
    
  } catch (error) {
    console.error('Error processing reciter:', error);
    return NextResponse.json(
      { error: 'Failed to process reciter' },
      { status: 500 }
    );
  }
} 