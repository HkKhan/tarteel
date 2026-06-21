export async function runPredictSpeaker(audioBase64: string, topK: number = 5) {
  const startTime = Date.now();
  const runpodEndpoint = process.env.RUNPOD_ENDPOINT_ID;
  const runpodApiKey = process.env.RUNPOD_API_KEY;

  if (!runpodEndpoint || !runpodApiKey) {
    throw new Error('Missing RUNPOD_ENDPOINT_ID or RUNPOD_API_KEY in environment variables');
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
        audio_b64: audioBase64,
        top_k: topK
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
  
  // Check final status
  if (result.status !== 'COMPLETED' || !result.output) {
     console.error("RunPod failure status:", result);
     throw new Error(`Prediction failed on RunPod backend (status: ${result.status})`);
  }

  const mlOutput = result.output;
  const processingTime = (Date.now() - startTime) / 1000;

  // Map RunPod output format to what the Tarteel UI expects
  const mappedPredictions = mlOutput.rankings.map((r: any) => ({
      speaker: r.name,
      confidence: r.score
  }));

    return {
      success: true,
      predictions: mappedPredictions,
      num_speakers: mappedPredictions.length,
      processing_time: processingTime,
      transcription: mlOutput.transcription,
      fatiha_verified: mlOutput.fatiha_verified,
      word_feedback: mlOutput.word_feedback || [],
      ref_audio_url: mlOutput.ref_audio_url || null
    };
  }
