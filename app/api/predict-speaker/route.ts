import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

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

    // Prepare input for Python script
    const inputData = {
      audio_base64: audio,
      format: format,
      top_k: top_k
    };

    // Path to Python predictor
    const scriptPath = path.join(process.cwd(), 'lib/speaker_prediction/predictor.py');
    
    // Execute Python predictor
    const result = await executePythonPredictor(scriptPath, inputData);
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Prediction failed'
      }, { status: 500 });
    }

    const processingTime = (Date.now() - startTime) / 1000;

    return NextResponse.json({
      success: true,
      predictions: result.predictions,
      num_speakers: result.num_speakers,
      processing_time: processingTime
    });

  } catch (error) {
    console.error('Speaker prediction error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

async function executePythonPredictor(scriptPath: string, inputData: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python', [scriptPath, JSON.stringify(inputData)]);
    
    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Python process error:', errorData);
        resolve({
          success: false,
          error: `Python process exited with code ${code}: ${errorData}`
        });
        return;
      }

      try {
        const result = JSON.parse(outputData.trim());
        resolve(result);
      } catch (parseError) {
        console.error('Failed to parse Python output:', outputData);
        resolve({
          success: false,
          error: 'Failed to parse prediction results'
        });
      }
    });

    pythonProcess.on('error', (err) => {
      console.error('Failed to start Python process:', err);
      resolve({
        success: false,
        error: `Failed to start Python process: ${err.message}`
      });
    });
  });
} 