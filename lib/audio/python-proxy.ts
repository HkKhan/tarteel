/**
 * Python Audio Processing Proxy
 * 
 * This module replaces the previous TFJS implementation by forwarding
 * all requests to the Python backend instead of processing in the browser.
 */

/**
 * Convert a Blob to a base64 encoded string
 */
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Extract audio features by sending to Python backend
 */
export async function extractAudioFeatures(audioBuffer: ArrayBuffer) {
  // Convert ArrayBuffer to Blob
  const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
  
  // Convert to base64
  const base64Data = await blobToBase64(blob);
  
  // Send to Python API
  const response = await fetch('/api/process-recitation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio: base64Data,
      audioType: 'audio/mpeg'
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText}`);
  }
  
  // Get the processed data
  const data = await response.json();
  
  // Return compatible structure with the old TFJS implementation
  return {
    mfcc: [],
    chroma: [],
    melSpectrogram: [],
    temporalFeatures: [],
    fusedFeatures: [],
    vectorEmbedding: data.feature_vector || []
  };
}

/**
 * Register a new reciter using the backend
 */
export async function registerReciter(audioBuffer: ArrayBuffer, reciterName: string) {
  // Convert ArrayBuffer to Blob
  const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
  
  // Create FormData for the API
  const formData = new FormData();
  formData.append('name', reciterName);
  formData.append('audio', blob);
  
  // Send to API
  const response = await fetch('/api/new-reciter', {
    method: 'POST',
    body: formData
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText}`);
  }
  
  return await response.json();
} 