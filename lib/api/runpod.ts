export async function runPredictSpeaker(audioBase64: string, topK: number = 5) {
  const startTime = Date.now();
  const cloudRunUrl = process.env.GCP_CLOUD_RUN_URL;

  if (!cloudRunUrl) {
    throw new Error('Missing GCP_CLOUD_RUN_URL in environment variables');
  }

  // Call Google Cloud Run API (Synchronous execution)
  const response = await fetch(`${cloudRunUrl}/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: {
        audio_b64: audioBase64,
        top_k: topK
      }
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Cloud Run API HTTP error:', errText);
    throw new Error(`Cloud Run API error: ${response.statusText}`);
  }

  const mlOutput = await response.json();
  
  if (mlOutput.error) {
     throw new Error(`Prediction failed: ${mlOutput.error}`);
  }

  const processingTime = (Date.now() - startTime) / 1000;

  // Map backend output format to what the Tarteel UI expects
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
