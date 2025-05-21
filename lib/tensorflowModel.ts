/**
 * TensorFlow.js Model Management Module
 * Handles loading and providing centralized access to ML models:
 * - Loading and caching speech commands model
 * - Feature extraction utilities
 * - Model prediction helpers
 */

import * as tf from '@tensorflow/tfjs';

// Global model cache
let speechCommandsModel: tf.LayersModel | null = null;

/**
 * Load the TensorFlow.js speech commands model
 * @returns Promise resolving to the loaded model
 */
export async function loadSpeechCommandsModel(): Promise<tf.LayersModel> {
  if (speechCommandsModel === null) {
    try {
      // Load TensorFlow.js for browser (WebGL or CPU backend)
      await tf.ready();
      
      // Log enabled backends
      console.log(`TensorFlow.js backend: ${tf.getBackend()}`);
      
      // Load the pre-trained speech commands model
      speechCommandsModel = await tf.loadLayersModel(
        'https://storage.googleapis.com/tfjs-models/tfjs/speech-commands/v0.3/browser_fft/18w/model.json'
      );
      
      console.log('TensorFlow.js speech commands model loaded successfully');
      console.log(`Model summary: ${speechCommandsModel.inputs.length} inputs, ${speechCommandsModel.outputs.length} outputs`);
      
      // Warm up the model with a dummy tensor to avoid initial prediction delay
      const dummyInput = tf.zeros([1, 43, 232, 1]);
      speechCommandsModel.predict(dummyInput);
      dummyInput.dispose();
      
    } catch (error) {
      console.error('Error loading TensorFlow.js model:', error);
      throw new Error('Failed to load TensorFlow.js model');
    }
  }
  
  return speechCommandsModel;
}

/**
 * Get the speech commands model, loading it if necessary
 * @returns Promise resolving to the model
 */
export async function getSpeechCommandsModel(): Promise<tf.LayersModel> {
  return speechCommandsModel || loadSpeechCommandsModel();
}

/**
 * Extract the intermediate layer from the model for feature extraction
 * @param layerName Name of the layer to extract (default is mel_spectrogram)
 * @returns Feature extraction model
 */
export async function getFeatureExtractionModel(layerName: string = 'mel_spectrogram'): Promise<tf.LayersModel> {
  const fullModel = await getSpeechCommandsModel();
  
  try {
    // Get the specified layer
    const featureLayer = fullModel.getLayer(layerName);
    
    // Create a new model that outputs the feature layer
    const featureModel = tf.model({
      inputs: fullModel.inputs,
      outputs: featureLayer.output
    });
    
    return featureModel;
  } catch (error) {
    console.error(`Error creating feature extraction model for layer ${layerName}:`, error);
    
    // Fallback to using the full model if layer not found
    console.warn(`Falling back to full model as feature extraction layer "${layerName}" not found`);
    return fullModel;
  }
}

/**
 * Memory management helper to dispose tensors
 * @param tensors Array of tensors to dispose
 */
export function disposeTensors(tensors: tf.Tensor[]): void {
  for (const tensor of tensors) {
    if (tensor && tensor.dispose) {
      tensor.dispose();
    }
  }
}

/**
 * Release all loaded models and tensors to free memory
 */
export async function cleanupModels(): Promise<void> {
  if (speechCommandsModel) {
    speechCommandsModel.dispose();
    speechCommandsModel = null;
  }
  
  // Force garbage collection of tensors
  tf.disposeVariables();
  tf.engine().purge();
  console.log('TensorFlow.js models and tensors cleaned up');
}

/**
 * Get memory info for debugging
 * @returns Memory info object
 */
export function getMemoryInfo(): tf.MemoryInfo {
  return tf.memory();
} 