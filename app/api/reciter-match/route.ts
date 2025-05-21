import { createClient } from '@/lib/supabase/server';
import { NextResponse } from "next/server";
import { extractAudioFeatures } from '@/lib/audio/processor';
import { findSimilarity } from '@/lib/matching/similaritySearch';
import { findSimilarReciters, getReciterVector } from '@/lib/supabase/vectorStore';
import { TajweedAspects } from '@/config/audio';

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
    
    // Initialize Supabase client
    const supabase = createClient();
    
    // 1. Extract audio buffer from file
    const audioBuffer = await audioFile.arrayBuffer();
    
    // 2. Extract features using the new pipeline
    console.log(`Extracting features from audio buffer of size: ${audioBuffer.byteLength} bytes`);
    const userFeatures = await extractAudioFeatures(audioBuffer);
    
    // 3. Find matching reciters
    let matchResults: any[] = [];
    let bestMatch: any = null;
    
    if (preferredReciterId) {
      // If specific reciter requested, get their vector
      console.log(`Looking up specific reciter: ${preferredReciterId}`);
      
      // Get reciter info
      const { data: reciter, error: reciterError } = await supabase
        .from('reciters')
        .select('id, name, style, sample_audio_url, feature_vector')
        .eq('id', preferredReciterId)
        .single();
      
      if (reciterError || !reciter) {
        console.error(`Error fetching preferred reciter ${preferredReciterId}:`, reciterError);
        return NextResponse.json(
          { error: `Reciter not found: ${reciterError?.message}` },
          { status: 404 }
        );
      }
      
      // Calculate similarity with specified reciter
      const reciterFeatureVector = reciter.feature_vector;
      if (!reciterFeatureVector) {
        return NextResponse.json(
          { error: 'Reciter does not have feature vector data' },
          { status: 400 }
        );
      }
      
      // Get complete feature set if needed
      let reciterFullFeatures = {
        mfcc: [],
        chroma: [],
        melSpectrogram: [],
        temporalFeatures: [],
        fusedFeatures: [],
        vectorEmbedding: reciterFeatureVector
      };
      
      // If vector store has additional structured features, retrieve them
      const additionalFeatures = await getReciterVector(preferredReciterId);
      if (additionalFeatures && Array.isArray(additionalFeatures)) {
        reciterFullFeatures.vectorEmbedding = additionalFeatures;
      }
      
      // Calculate detailed similarity
      const similarityResult = findSimilarity(userFeatures, reciterFullFeatures);
      
      // Create match result
      bestMatch = {
        reciterId: reciter.id,
        reciterName: reciter.name,
        style: reciter.style,
        audioUrl: reciter.sample_audio_url,
        similarityScore: similarityResult.overallScore,
        aspectScores: similarityResult.aspectScores,
        justifications: similarityResult.justifications,
        confidenceScore: similarityResult.confidenceScore
      };
      
      matchResults = [bestMatch];
    } else {
      // Otherwise find top matches using vector search
      console.log('Finding top matching reciters using vector search');
      
      // Use vector store to find similar reciters
      const vectorMatches = await findSimilarReciters(
        userFeatures.vectorEmbedding,
        5,  // Get top 5 matches
        0.6  // Minimum similarity threshold
      );
      
      // Process each match
      matchResults = await Promise.all(
        vectorMatches.map(async (match) => {
          // Get reciter's full features if available (basic vector embedding is already in match)
          let reciterFullFeatures = {
            mfcc: [],
            chroma: [],
            melSpectrogram: [],
            temporalFeatures: [],
            fusedFeatures: [],
            vectorEmbedding: match.feature_vector
          };
          
          // Calculate detailed similarity
          const similarityResult = findSimilarity(userFeatures, reciterFullFeatures);
          
          return {
            reciterId: match.id,
            reciterName: match.name,
            style: match.style,
            audioUrl: match.sample_audio_url,
            similarityScore: similarityResult.overallScore,
            aspectScores: similarityResult.aspectScores,
            justifications: similarityResult.justifications,
            confidenceScore: similarityResult.confidenceScore
          };
        })
      );
      
      // Sort by similarity score in descending order
      matchResults.sort((a, b) => b.similarityScore - a.similarityScore);
      
      // Set best match
      bestMatch = matchResults.length > 0 ? matchResults[0] : null;
    }
    
    // 4. Prepare response
    if (!bestMatch) {
      // No matches found
      return NextResponse.json({
        message: 'No matching reciters found',
        matchResults: []
      });
    }
    
    // Get best scores per aspect to help with feedback
    const bestScorePerAspect: Record<string, { score: number; reciterName: string }> = {};
    
    for (const aspect of TajweedAspects) {
      // Initialize with first match
      bestScorePerAspect[aspect] = {
        score: matchResults[0].aspectScores[aspect],
        reciterName: matchResults[0].reciterName
      };
      
      // Check all other matches
      for (let i = 1; i < matchResults.length; i++) {
        if (matchResults[i].aspectScores[aspect] > bestScorePerAspect[aspect].score) {
          bestScorePerAspect[aspect] = {
            score: matchResults[i].aspectScores[aspect],
            reciterName: matchResults[i].reciterName
          };
        }
      }
    }
    
    // Generate general feedback based on best match
    const generalFeedback = [
      `Your recitation most closely matches ${bestMatch.reciterName} (${Math.round(bestMatch.similarityScore)}% match)`,
      `You excel in ${findStrongestAspect(bestMatch.aspectScores)}`,
      `For improvement, focus on your ${findWeakestAspect(bestMatch.aspectScores)}`
    ];
    
    // Return results
    return NextResponse.json({
      bestMatch,
      matchResults,
      generalFeedback,
      bestScorePerAspect,
      // Include feature info for debugging
      featureInfo: {
        mfccCount: userFeatures.mfcc.length,
        chromaCount: userFeatures.chroma.length,
        melSpectrogramSize: userFeatures.melSpectrogram.length,
        vectorEmbeddingDimension: userFeatures.vectorEmbedding.length
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