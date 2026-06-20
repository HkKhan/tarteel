import { runPredictSpeaker } from '@/lib/api/runpod';

export const maxDuration = 300; // Allow 5 minutes for RunPod cold starts

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { audio, format = 'mp3', top_k = 5 } = body;
    
    if (!audio) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing audio data' 
      }, { status: 400 });
    }

    const predictionData = await runPredictSpeaker(audio, top_k);
    return NextResponse.json(predictionData);

  } catch (error: any) {
    console.error('Speaker prediction error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error processing prediction'
    }, { status: 500 });
  }
}