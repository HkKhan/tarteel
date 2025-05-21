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
    
    // Initialize Supabase client
    const supabase = createClient();
    
    // In development, just return mock data
    // In production, this endpoint will be handled by the Python function
    
    // Get some reciters to mock matches
    const { data: reciters, error } = await supabase
      .from('reciters')
      .select('id, name, style')
      .limit(5);
    
    if (error) {
      console.error('Error fetching reciters:', error);
      return NextResponse.json(
        { error: 'Failed to process audio' },
        { status: 500 }
      );
    }
    
    // Create mock match results
    const matches = reciters.map((reciter: any) => ({
      id: reciter.id,
      name: reciter.name,
      style: reciter.style,
      similarity_score: Math.random() * 0.3 + 0.6, // Random score between 0.6 and 0.9
      aspect_scores: {
        intonation: Math.random() * 0.5 + 0.5,
        pace: Math.random() * 0.5 + 0.5,
        melody: Math.random() * 0.5 + 0.5,
        strength: Math.random() * 0.5 + 0.5,
        articulation: Math.random() * 0.5 + 0.5,
        fluency: Math.random() * 0.5 + 0.5,
        rhythm: Math.random() * 0.5 + 0.5
      }
    }));
    
    // Sort by similarity score
    matches.sort((a: any, b: any) => b.similarity_score - a.similarity_score);
    
    return NextResponse.json({
      matches,
      feature_info: {
        mfcc_shape: [20, 100],
        chroma_shape: [12, 100],
        mel_shape: [128, 100],
        feature_dimension: 92
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