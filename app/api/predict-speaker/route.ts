import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300; // Allow 5 minutes for RunPod cold starts

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now();
    const body = await request.json();
    
    const { audio, format = 'mp3', top_k = 5 } = body;
    
    if (!audio) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing audio data' 
      }, { status: 400 });
    }

    const runpodEndpoint = process.env.RUNPOD_ENDPOINT_ID;
    const runpodApiKey = process.env.RUNPOD_API_KEY;

    if (!runpodEndpoint || !runpodApiKey) {
      console.error('Missing RUNPOD_ENDPOINT_ID or RUNPOD_API_KEY in environment variables');
      return NextResponse.json({ 
        success: false, 
        error: 'Server configuration error' 
      }, { status: 500 });
    }

    // Call RunPod Serverless API (Synchronous execution)
    const runpodResponse = await fetch(`https://api.runpod.ai/v2/${runpodEndpoint}/runsync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${runpodApiKey}`,
      },
      body: JSON.stringify({
        input: {
          audio_b64: audio,
          top_k: top_k
        }
      }),
    });

    if (!runpodResponse.ok) {
      const errText = await runpodResponse.text();
      console.error('RunPod API HTTP error:', errText);
      throw new Error(`RunPod API error: ${runpodResponse.statusText}`);
    }

    let result = await runpodResponse.json();
    
    // If RunPod is cold starting or taking a while, it returns IN_QUEUE or IN_PROGRESS
    if (result.status === 'IN_QUEUE' || result.status === 'IN_PROGRESS') {
      const jobId = result.id;
      const statusUrl = `https://api.runpod.ai/v2/${runpodEndpoint}/status/${jobId}`;
      
      // Poll for up to 240 seconds
      const maxRetries = 48; // 48 * 5s = 240s
      let retries = 0;
      
      while ((result.status === 'IN_QUEUE' || result.status === 'IN_PROGRESS') && retries < maxRetries) {
        // Wait 5 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const statusResponse = await fetch(statusUrl, {
          headers: {
            'Authorization': `Bearer ${runpodApiKey}`,
          }
        });
        
        if (statusResponse.ok) {
          result = await statusResponse.json();
        }
        retries++;
      }
    }
    
    // RunPod API wraps the returned JSON in an "output" field
    if (result.status !== 'COMPLETED' || !result.output) {
       console.error("RunPod failure status:", result);
       throw new Error(`Prediction failed on RunPod backend (status: ${result.status})`);
    }

    const mlOutput = result.output;
    const processingTime = (Date.now() - startTime) / 1000;

    // Map RunPod output format to what the Tarteel UI expects
    // RunPod output: { best_match: {name, score}, rankings: [{name, score}, ...], transcription, fatiha_verified }
    // Tarteel UI expects: { predictions: [{speaker, confidence}, ...], num_speakers, processing_time }
    
    const mappedPredictions = mlOutput.rankings.map((r: any) => ({
        speaker: r.name,
        confidence: r.score
    }));

    return NextResponse.json({
      success: true,
      predictions: mappedPredictions,
      num_speakers: mappedPredictions.length,
      processing_time: processingTime,
      transcription: mlOutput.transcription,
      fatiha_verified: mlOutput.fatiha_verified,
      word_feedback: mlOutput.word_feedback || []
    });

  } catch (error) {
    console.error('Speaker prediction error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error processing prediction'
    }, { status: 500 });
  }
}