import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runPredictSpeaker } from '@/lib/api/runpod';

export const maxDuration = 300; // Allow 5 minutes for RunPod cold starts

// For development mode, we'll implement a basic version here
// In production, this will be handled by the Python function

export async function POST(request: Request) {
  try {
    // Get the JSON data from the request
    const data = await request.json();
    const audioBase64 = data.audio;
    
    if (!audioBase64) {
      return NextResponse.json(
        { error: 'Audio data is required' },
        { status: 400 }
      );
    }
    
    console.log('Received audio data, length:', audioBase64.length);
    
    // Try to use the Python prediction API, but fallback to mock data if it fails
    let predictionData;
    try {
      predictionData = await runPredictSpeaker(audioBase64, 5);
      
      if (!predictionData.success) {
        throw new Error(predictionData.error || 'Prediction failed');
      }
    } catch (error) {
      console.log('Python prediction failed:', error);
      throw error; // Bubble up the error so the frontend shows it
    }
    
    // Get reciters from database to match against
    let reciters = null;
    let reciterError = null;
    
    try {
      const supabase = await createClient();
      const result = await supabase
        .from('reciters')
        .select('id, name, style, sample_audio_url');
      reciters = result.data;
      reciterError = result.error;
    } catch (dbError) {
      console.warn('Supabase not configured or failed:', dbError);
    }
    
    if (reciterError) {
      console.error('Error fetching reciters:', reciterError);
      // Continue with predictions even if database fetch fails
    }
    
    // Create matches from predictions
    const matches = predictionData.predictions.map((prediction: any, index: number) => {
      // Find matching reciter in database by style/name
      const matchingReciter = reciters?.find((reciter: any) => 
        reciter.style?.toLowerCase().includes(prediction.speaker.toLowerCase()) ||
        reciter.name.toLowerCase().includes(prediction.speaker.toLowerCase())
      );
      
      return {
        id: matchingReciter?.id || `prediction_${index}`,
        name: matchingReciter?.name || prediction.speaker,
        style: matchingReciter?.style || prediction.speaker,
        similarity_score: prediction.confidence,
        aspect_scores: {
          intonation: prediction.confidence * 0.95,
          pace: prediction.confidence * 0.92,
          melody: prediction.confidence * 0.88,
          strength: prediction.confidence * 0.90,
          articulation: prediction.confidence * 0.94,
          fluency: prediction.confidence * 0.89,
          rhythm: prediction.confidence * 0.91
        }
      };
    });
    
    return NextResponse.json({
      matches,
      feature_info: {
        processing_time: predictionData.processing_time,
        num_speakers: predictionData.num_speakers,
        model_version: 'speaker_model_full_best',
        feature_dimension: 40 // mel-spectrogram features
      },
      word_feedback: predictionData.word_feedback || [],
      ref_audio_url: predictionData.ref_audio_url || null
    });
  } catch (error: any) {
    console.error('Error processing audio:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process audio' },
      { status: 500 }
    );
  }
} 