import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    
    // Use the new speaker prediction API
    const predictionResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/predict-speaker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio: audioBase64,
        format: 'mp3',
        top_k: 5
      })
    });
    
    if (!predictionResponse.ok) {
      throw new Error('Speaker prediction failed');
    }
    
    const predictionData = await predictionResponse.json();
    
    if (!predictionData.success) {
      throw new Error(predictionData.error || 'Prediction failed');
    }
    
    // Get reciters from database to match against
    const supabase = await createClient();
    const { data: reciters, error: reciterError } = await supabase
      .from('reciters')
      .select('id, name, style, sample_audio_url');
    
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
      }
    });
  } catch (error) {
    console.error('Error processing audio:', error);
    return NextResponse.json(
      { error: 'Failed to process audio' },
      { status: 500 }
    );
  }
} 