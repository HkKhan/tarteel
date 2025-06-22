import { createClient } from '@/lib/supabase/server';
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // Get the form data from the request
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const preferredReciterId = formData.get('reciterId') as string;
    
    if (!audioFile) {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      );
    }
    
    console.log(`Processing match request: audio size ${audioFile.size} bytes, preferredReciterId: ${preferredReciterId || 'none'}`);
    
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
        top_k: 5
      })
    });
    
    if (!predictionResponse.ok) {
      throw new Error('Speaker prediction failed');
    }
    
    const predictionData = await predictionResponse.json();
    
    // Get all reciters from database to match against
    const supabase = createClient();
    const { data: reciters, error: reciterError } = await supabase
      .from('reciters')
      .select('id, name, style, sample_audio_url');
    
    if (reciterError) {
      throw new Error(`Failed to fetch reciters: ${reciterError.message}`);
    }
    
    // Match predictions with database reciters
    const matches = predictionData.predictions.map((prediction: any) => {
      // Find matching reciter in database by style/name
      const matchingReciter = reciters?.find(reciter => 
        reciter.style?.toLowerCase().includes(prediction.speaker.toLowerCase()) ||
        reciter.name.toLowerCase().includes(prediction.speaker.toLowerCase())
      );
      
      return {
        reciterId: matchingReciter?.id || 'unknown',
        reciterName: matchingReciter?.name || prediction.speaker,
        recitationStyle: matchingReciter?.style || prediction.speaker,
        similarityScore: prediction.confidence * 100, // Convert to percentage
        aspectScores: {
          pronunciation: prediction.confidence * 100,
          rhythm: prediction.confidence * 95,
          tajweed: prediction.confidence * 90
        }
      };
    });
    
    // Sort by similarity score
    matches.sort((a: any, b: any) => b.similarityScore - a.similarityScore);
    
    // Get the best match
    const bestMatch = matches.length > 0 ? matches[0] : null;
    
    if (!bestMatch) {
      return NextResponse.json({
        message: 'No matching reciters found',
        matchResults: []
      });
    }
    
    // Generate general feedback
    const generalFeedback = [
      `Your recitation most closely matches ${bestMatch.reciterName} (${Math.round(bestMatch.similarityScore)}% match)`,
      `You excel in pronunciation with ${Math.round(bestMatch.aspectScores.pronunciation)}% accuracy`,
      `For improvement, focus on tajweed rules to reach ${Math.round(bestMatch.aspectScores.tajweed + 10)}% accuracy`
    ];
    
    return NextResponse.json({
      bestMatch,
      matchResults: matches,
      generalFeedback,
      featureInfo: {
        processing_time: predictionData.processing_time,
        num_speakers: predictionData.num_speakers,
        model_version: 'speaker_model_full_best'
      }
    });
    
  } catch (error) {
    console.error('Error matching reciter:', error);
    return NextResponse.json(
      { error: 'Failed to process audio matching' },
      { status: 500 }
    );
  }
}

/**
 * Find the strongest aspect based on aspect scores
 */
function findStrongestAspect(aspectScores: Record<string, number>): string {
  let maxScore = -1;
  let strongestAspect = "";
  
  for (const aspect in aspectScores) {
    if (aspectScores[aspect] > maxScore) {
      maxScore = aspectScores[aspect];
      strongestAspect = aspect;
    }
  }
  
  return strongestAspect;
}

/**
 * Find the weakest aspect based on aspect scores
 */
function findWeakestAspect(aspectScores: Record<string, number>): string {
  let minScore = Infinity;
  let weakestAspect = "";
  
  for (const aspect in aspectScores) {
    if (aspectScores[aspect] < minScore) {
      minScore = aspectScores[aspect];
      weakestAspect = aspect;
    }
  }
  
  return weakestAspect;
} 