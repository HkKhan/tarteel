import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

/**
 * API handler for detailed audio matching using Python
 * This endpoint takes user audio features and reciter features,
 * and performs a detailed two-stage matching using DTW and segment comparison
 */
export async function POST(request) {
  try {
    // Parse JSON body
    const body = await request.json();
    const { userFeatures, reciterFeatures } = body;
    
    if (!userFeatures || !reciterFeatures) {
      return NextResponse.json(
        { error: 'Missing required features data' },
        { status: 400 }
      );
    }
    
    // Call Python processor for detailed matching
    const result = await callPythonMatcher(userFeatures, reciterFeatures);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in match-detailed API:', error);
    return NextResponse.json(
      { error: 'Failed to process audio matching', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Call Python processor script to perform two-stage matching
 * 
 * @param {Object} userFeatures - User audio features
 * @param {Object} reciterFeatures - Reciter audio features
 * @returns {Promise<Object>} - Matching results
 */
async function callPythonMatcher(userFeatures, reciterFeatures) {
  return new Promise((resolve, reject) => {
    // Create temporary input data to pass to Python
    const inputData = {
      sample1: userFeatures,
      sample2: reciterFeatures
    };
    
    // Path to Python script (relative to project root)
    const scriptPath = path.join(process.cwd(), 'lib/audio/python_processor.py');
    
    // Spawn Python process
    const pythonProcess = spawn('python', [
      scriptPath,
      '--match',
      JSON.stringify(inputData)
    ]);
    
    let result = '';
    let errorData = '';
    
    // Collect data from stdout
    pythonProcess.stdout.on('data', (data) => {
      result += data.toString();
    });
    
    // Collect any errors
    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });
    
    // Handle process completion
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python process exited with code ${code}`);
        console.error('Python error:', errorData);
        
        // Fallback to basic similarity if Python fails
        const fallbackSimilarity = calculateFallbackSimilarity(
          userFeatures.feature_vector, 
          reciterFeatures.feature_vector
        );
        
        resolve({
          similarity: fallbackSimilarity,
          method: 'js_fallback',
          stage: 1,
          error: errorData
        });
      } else {
        try {
          const jsonResult = JSON.parse(result);
          resolve(jsonResult);
        } catch (error) {
          console.error('Error parsing Python output:', error);
          reject(new Error('Invalid output from Python processor'));
        }
      }
    });
  });
}

/**
 * Fallback similarity calculation if Python fails
 * 
 * @param {Array} vector1 - First feature vector
 * @param {Array} vector2 - Second feature vector
 * @returns {number} - Similarity score
 */
function calculateFallbackSimilarity(vector1, vector2) {
  if (!vector1 || !vector2 || vector1.length !== vector2.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  for (let i = 0; i < vector1.length; i++) {
    dotProduct += vector1[i] * vector2[i];
    magnitude1 += vector1[i] * vector1[i];
    magnitude2 += vector2[i] * vector2[i];
  }
  
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }
  
  return dotProduct / (magnitude1 * magnitude2);
} 