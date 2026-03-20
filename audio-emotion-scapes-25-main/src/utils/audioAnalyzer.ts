/**
 * Audio Analyzer with ONNX Runtime Web ML Model Integration
 * 
 * This module handles:
 * 1. Audio feature extraction (ZCR, RMS, MFCCs) to match training parameters
 * 2. ONNX Runtime Web model loading and caching
 * 3. Emotion prediction using the trained LSTM model
 */

import * as ort from 'onnxruntime-web';
import Meyda from 'meyda';

// ============================================================================
// Types and Constants
// ============================================================================

export type Gender = 'female' | 'male' | 'unknown';

export type Emotion = 'angry' | 'disgust' | 'fear' | 'happy' | 'sad' | 'neutral';

// Emotion mapping from model output index to emotion label
const EMOTION_MAP: Record<number, Emotion> = {
  0: 'angry',
  1: 'disgust',
  2: 'fear',
  3: 'happy',
  4: 'sad',
  5: 'neutral',
};

// Feature extraction parameters (must match training)
const SAMPLE_RATE = 22050;
const HOP_LENGTH = 512;
const FRAME_LENGTH = 2048;
const NUM_MFCCS = 13;
const TARGET_SEQ_LENGTH = 352; // Number of frames expected by the model
const NUM_FEATURES = 15; // ZCR (1) + RMS (1) + MFCCs (13)

// Model paths - now using ONNX files directly!
const MODEL_PATHS: Record<Gender, string> = {
  female: '/models/onnx/emotion_female.onnx',
  male: '/models/onnx/emotion_male.onnx',
  unknown: '/models/onnx/emotion_combined.onnx',
};

// ============================================================================
// Model Management
// ============================================================================

// Cache loaded models to avoid reloading
const modelCache: Map<Gender, ort.InferenceSession> = new Map();

/**
 * Load an ONNX model for the specified gender
 * Handles models with external data files (.onnx.data)
 */
export async function loadModel(gender: Gender): Promise<ort.InferenceSession> {
  // Check cache first
  if (modelCache.has(gender)) {
    return modelCache.get(gender)!;
  }

  const modelPath = MODEL_PATHS[gender];
  const dataPath = `${modelPath}.data`;
  console.log(`Loading ONNX emotion model for ${gender} from ${modelPath}...`);

  try {
    // Configure ONNX Runtime Web - use single thread for compatibility
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/';
    ort.env.wasm.numThreads = 1;
    
    // Fetch the model file
    console.log(`Fetching model file: ${modelPath}`);
    const modelResponse = await fetch(modelPath);
    if (!modelResponse.ok) {
      throw new Error(`Failed to fetch model: ${modelResponse.status} ${modelResponse.statusText}`);
    }
    const modelArrayBuffer = await modelResponse.arrayBuffer();
    console.log(`Model file loaded: ${modelArrayBuffer.byteLength} bytes`);
    
    // Fetch the external data file
    console.log(`Fetching external data file: ${dataPath}`);
    const dataResponse = await fetch(dataPath);
    if (!dataResponse.ok) {
      throw new Error(`Failed to fetch external data: ${dataResponse.status} ${dataResponse.statusText}`);
    }
    const dataArrayBuffer = await dataResponse.arrayBuffer();
    console.log(`External data loaded: ${dataArrayBuffer.byteLength} bytes`);
    
    // Get the filename for the external data (must match what's referenced in the .onnx file)
    const modelFileName = modelPath.split('/').pop() || 'model.onnx';
    const dataFileName = `${modelFileName}.data`;
    
    console.log(`Creating session with external data: ${dataFileName}`);
    
    // Create session with external data
    const session = await ort.InferenceSession.create(
      new Uint8Array(modelArrayBuffer),
      {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
        externalData: [
          {
            path: dataFileName,
            data: new Uint8Array(dataArrayBuffer),
          }
        ],
      }
    );
    
    modelCache.set(gender, session);
    console.log(`ONNX model loaded successfully for ${gender}`);
    console.log(`Input names: ${session.inputNames}`);
    console.log(`Output names: ${session.outputNames}`);
    return session;
  } catch (error) {
    console.error(`Failed to load ONNX model for ${gender}:`, error);
    throw new Error(`Could not load emotion model for ${gender}. Make sure the model file exists at ${modelPath}. Error: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Preload all models (call on app startup for better UX)
 */
export async function preloadModels(): Promise<void> {
  const genders: Gender[] = ['female', 'male', 'unknown'];
  
  await Promise.all(
    genders.map(async (gender) => {
      try {
        await loadModel(gender);
      } catch (error) {
        console.warn(`Could not preload ${gender} model:`, error);
      }
    })
  );
}

// ============================================================================
// Audio Feature Extraction
// ============================================================================

/**
 * Resample audio to target sample rate using linear interpolation
 */
function resampleAudio(audioData: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) {
    return audioData;
  }

  const ratio = fromRate / toRate;
  const newLength = Math.floor(audioData.length / ratio);
  const resampled = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, audioData.length - 1);
    const t = srcIndex - srcIndexFloor;
    
    resampled[i] = audioData[srcIndexFloor] * (1 - t) + audioData[srcIndexCeil] * t;
  }

  return resampled;
}

/**
 * Trim silence from the beginning and end of audio
 */
function trimSilence(audioData: Float32Array, threshold: number = 0.01): Float32Array {
  let start = 0;
  let end = audioData.length - 1;

  // Find start (first sample above threshold)
  while (start < audioData.length && Math.abs(audioData[start]) < threshold) {
    start++;
  }

  // Find end (last sample above threshold)
  while (end > start && Math.abs(audioData[end]) < threshold) {
    end--;
  }

  // Add small padding
  start = Math.max(0, start - 100);
  end = Math.min(audioData.length - 1, end + 100);

  return audioData.slice(start, end + 1);
}

/**
 * Pad or truncate audio to target length
 */
function padOrTruncate(audioData: Float32Array, targetLength: number): Float32Array {
  if (audioData.length >= targetLength) {
    return audioData.slice(0, targetLength);
  }

  const padded = new Float32Array(targetLength);
  padded.set(audioData);
  return padded;
}

/**
 * Calculate Zero Crossing Rate for a frame
 */
function calculateZCR(frame: Float32Array): number {
  let crossings = 0;
  for (let i = 1; i < frame.length; i++) {
    if ((frame[i] >= 0 && frame[i - 1] < 0) || (frame[i] < 0 && frame[i - 1] >= 0)) {
      crossings++;
    }
  }
  return crossings / (frame.length - 1);
}

/**
 * Calculate RMS (Root Mean Square) for a frame
 */
function calculateRMS(frame: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) {
    sum += frame[i] * frame[i];
  }
  return Math.sqrt(sum / frame.length);
}

/**
 * Extract features from audio data to match training format
 * Returns: (seq_length, 15) array where each frame has [ZCR, RMS, MFCC1-13]
 */
export function extractFeatures(audioData: Float32Array, sampleRate: number): Float32Array[] {
  // Resample to target sample rate if needed
  const resampled = resampleAudio(audioData, sampleRate, SAMPLE_RATE);
  
  // Trim silence
  const trimmed = trimSilence(resampled);
  
  // Calculate expected audio length for TARGET_SEQ_LENGTH frames
  const targetAudioLength = (TARGET_SEQ_LENGTH - 1) * HOP_LENGTH + FRAME_LENGTH;
  
  // Pad or truncate
  const processed = padOrTruncate(trimmed, targetAudioLength);
  
  // Extract features frame by frame
  const frames: Float32Array[] = [];
  
  // Configure Meyda for MFCC extraction
  const meydaBufferSize = FRAME_LENGTH;
  
  for (let i = 0; i + FRAME_LENGTH <= processed.length; i += HOP_LENGTH) {
    const frame = processed.slice(i, i + FRAME_LENGTH);
    
    // Ensure frame is exactly the right size for Meyda
    const paddedFrame = new Float32Array(meydaBufferSize);
    paddedFrame.set(frame.slice(0, meydaBufferSize));
    
    // Calculate ZCR and RMS manually (more reliable)
    const zcr = calculateZCR(paddedFrame);
    const rms = calculateRMS(paddedFrame);
    
    // Extract MFCCs using Meyda
    let mfccs: number[];
    try {
      const meydaFeatures = Meyda.extract(['mfcc'], paddedFrame) as { mfcc: number[] } | null;
      mfccs = meydaFeatures?.mfcc?.slice(0, NUM_MFCCS) || new Array(NUM_MFCCS).fill(0);
    } catch {
      mfccs = new Array(NUM_MFCCS).fill(0);
    }
    
    // Combine features: [ZCR, RMS, MFCC1, MFCC2, ..., MFCC13]
    const features = new Float32Array(NUM_FEATURES);
    features[0] = zcr;
    features[1] = rms;
    for (let j = 0; j < NUM_MFCCS; j++) {
      features[2 + j] = mfccs[j] || 0;
    }
    
    frames.push(features);
    
    // Stop if we have enough frames
    if (frames.length >= TARGET_SEQ_LENGTH) {
      break;
    }
  }
  
  // Pad with zeros if we don't have enough frames
  while (frames.length < TARGET_SEQ_LENGTH) {
    frames.push(new Float32Array(NUM_FEATURES));
  }
  
  return frames;
}

// ============================================================================
// Emotion Prediction
// ============================================================================

// ML features that are actually used by the model
export interface MLFeatures {
  zcr: number;        // Zero Crossing Rate (average across frames)
  rms: number;        // Root Mean Square / Loudness (average across frames)
  mfccAvg: number;    // Average of all MFCC coefficients (summary)
}

export interface PredictionResult {
  emotion: Emotion;
  confidence: number;
  probabilities: Record<Emotion, number>;
  mlFeatures: MLFeatures;  // Actual features used by the model
}

/**
 * Predict emotion from audio features using the ONNX Runtime Web model
 */
export async function predictEmotion(
  audioBlob: Blob,
  gender: Gender = 'unknown'
): Promise<PredictionResult> {
  console.log(`Predicting emotion for ${gender} voice using ONNX Runtime...`);
  
  // Load model
  const session = await loadModel(gender);
  
  // Decode audio
  const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  // Get audio data (mono)
  const audioData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  
  console.log(`Audio: ${audioData.length} samples at ${sampleRate} Hz`);
  
  // Extract features
  const features = extractFeatures(audioData, sampleRate);
  console.log(`Extracted ${features.length} frames with ${features[0]?.length || 0} features each`);
  
  // Flatten features into a single Float32Array for ONNX
  // Shape: [1, 352, 15] -> flattened
  const flattenedData = new Float32Array(1 * TARGET_SEQ_LENGTH * NUM_FEATURES);
  for (let i = 0; i < features.length; i++) {
    for (let j = 0; j < NUM_FEATURES; j++) {
      flattenedData[i * NUM_FEATURES + j] = features[i][j];
    }
  }
  
  // Create ONNX tensor
  const inputTensor = new ort.Tensor('float32', flattenedData, [1, TARGET_SEQ_LENGTH, NUM_FEATURES]);
  
  // Get the input name from the model
  const inputName = session.inputNames[0];
  
  // Run inference
  const feeds: Record<string, ort.Tensor> = {};
  feeds[inputName] = inputTensor;
  
  const results = await session.run(feeds);
  
  // Get output
  const outputName = session.outputNames[0];
  const outputTensor = results[outputName];
  const logits = outputTensor.data as Float32Array;
  
  // Apply softmax to get probabilities
  const maxLogit = Math.max(...Array.from(logits));
  const expLogits = Array.from(logits).map(l => Math.exp(l - maxLogit));
  const sumExp = expLogits.reduce((a, b) => a + b, 0);
  const probabilities = expLogits.map(e => e / sumExp);
  
  // Find predicted class
  const predictedIndex = probabilities.indexOf(Math.max(...probabilities));
  const emotion = EMOTION_MAP[predictedIndex];
  const confidence = probabilities[predictedIndex];
  
  // Build probability map
  const probabilityMap: Record<Emotion, number> = {} as Record<Emotion, number>;
  for (let i = 0; i < probabilities.length; i++) {
    probabilityMap[EMOTION_MAP[i]] = probabilities[i];
  }
  
  // Calculate average ML features for display
  let zcrSum = 0, rmsSum = 0, mfccSum = 0;
  for (const frame of features) {
    zcrSum += frame[0];  // ZCR is at index 0
    rmsSum += frame[1];  // RMS is at index 1
    // MFCCs are at indices 2-14
    for (let j = 2; j < NUM_FEATURES; j++) {
      mfccSum += Math.abs(frame[j]);  // Use absolute value for summary
    }
  }
  const numFrames = features.length;
  const mlFeatures: MLFeatures = {
    zcr: Math.min(1, zcrSum / numFrames),  // Already normalized 0-1
    rms: Math.min(1, rmsSum / numFrames * 5),  // Scale up for visibility
    mfccAvg: Math.min(1, Math.abs(mfccSum / (numFrames * NUM_MFCCS)) / 50),  // Normalize MFCC average
  };
  
  // Cleanup
  await audioContext.close();
  
  console.log(`Predicted: ${emotion} with ${(confidence * 100).toFixed(1)}% confidence`);
  console.log(`ML Features - ZCR: ${mlFeatures.zcr.toFixed(3)}, RMS: ${mlFeatures.rms.toFixed(3)}, MFCC: ${mlFeatures.mfccAvg.toFixed(3)}`);
  
  return {
    emotion,
    confidence,
    probabilities: probabilityMap,
    mlFeatures,
  };
}

// ============================================================================
// Legacy Support (for backward compatibility with existing code)
// ============================================================================

import { type Mood } from '@/components/MoodSelector';

// Map ML emotions to app moods (now 1:1 since Mood matches Emotion)
const EMOTION_TO_MOOD: Record<Emotion, Mood> = {
  angry: 'angry',
  disgust: 'disgust',
  fear: 'fear',
  happy: 'happy',
  sad: 'sad',
  neutral: 'neutral',
};

export interface AudioFeatures {
  energy: number;
  spectralCentroid: number;
  spectralFlatness: number;
  spectralRolloff: number;
  zcr: number;
  rms: number;
  tempo?: number;
}

const defaultFeatures: AudioFeatures = {
  energy: 0.5,
  spectralCentroid: 0.5,
  spectralFlatness: 0.5,
  spectralRolloff: 0.5,
  zcr: 0.5,
  rms: 0.5,
  tempo: 120,
};

/**
 * Legacy function: Analyze audio and extract basic features
 * (Kept for backward compatibility with existing UI)
 */
export const analyzeAudio = async (audioBlob: Blob): Promise<AudioFeatures> => {
  try {
    const audioContext = new AudioContext();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    const chunkSize = Math.min(16384, channelData.length);
    const chunksCount = Math.max(1, Math.floor(channelData.length / chunkSize));
    
    let energySum = 0;
    let centroidSum = 0;
    let flatnessSum = 0;
    let rolloffSum = 0;
    let zcrSum = 0;
    let rmsSum = 0;
    
    for (let i = 0; i < chunksCount; i++) {
      const start = i * chunkSize;
      const chunk = channelData.slice(start, start + chunkSize);
      
      const features = Meyda.extract([
        'energy', 
        'spectralCentroid', 
        'spectralFlatness', 
        'spectralRolloff',
        'zcr', 
        'rms'
      ], chunk) as Record<string, number> | null;
      
      if (features) {
        energySum += features.energy || 0;
        centroidSum += features.spectralCentroid || 0;
        flatnessSum += features.spectralFlatness || 0;
        rolloffSum += features.spectralRolloff || 0;
        zcrSum += features.zcr || 0;
        rmsSum += features.rms || 0;
      }
    }
    
    const results: AudioFeatures = {
      energy: Math.min(1, Math.max(0, energySum / chunksCount / 100)),
      spectralCentroid: Math.min(1, Math.max(0, centroidSum / chunksCount / 5000)),
      spectralFlatness: Math.min(1, Math.max(0, flatnessSum / chunksCount)),
      spectralRolloff: Math.min(1, Math.max(0, rolloffSum / chunksCount / 22050)),
      zcr: Math.min(1, Math.max(0, zcrSum / chunksCount / 1000)),
      rms: Math.min(1, Math.max(0, rmsSum / chunksCount * 10)),
      tempo: 120,
    };
    
    await audioContext.close();
    return results;
  } catch (error) {
    console.error("Error in audio analysis:", error);
    return defaultFeatures;
  }
};

/**
 * Legacy function: Predict mood using heuristics (fallback)
 * Improved with more nuanced detection based on audio characteristics
 */
export const predictMoodFromFeatures = (features: AudioFeatures): Mood => {
  const { energy, spectralCentroid, spectralFlatness, zcr, rms } = features;
  
  // Calculate a combined "arousal" score (how intense/active the audio is)
  const arousal = (energy + rms + zcr) / 3;
  
  // Calculate a "valence" approximation (bright = positive, dark = negative)
  const valence = (spectralCentroid + (1 - spectralFlatness)) / 2;
  
  // Calculate brightness/harshness
  const brightness = spectralCentroid;
  const harshness = spectralFlatness; // Low flatness = harsh/noisy
  
  console.log('Heuristic features:', { energy, spectralCentroid, spectralFlatness, zcr, rms, arousal, valence, brightness, harshness });
  
  // High arousal emotions (energy + intensity)
  if (arousal > 0.6) {
    if (valence > 0.65) {
      return 'happy';  // High energy + bright = happy/excited
    } else if (valence > 0.5 && brightness > 0.55) {
      return 'happy';  // Still generally positive
    } else if (harshness > 0.7 && valence < 0.35) {
      return 'angry';  // High energy + harsh + dark = angry
    } else if (harshness < 0.3 && valence < 0.35) {
      return 'fear';   // High energy + smooth + dark = fear/anxiety
    } else {
      return 'neutral';  // Fallback to a supported app mood when arousal is high but ambiguous
    }
  }
  
  // Medium-high arousal
  if (arousal > 0.45) {
    if (valence > 0.6) {
      return 'happy';
    } else if (valence > 0.45) {
      return 'neutral';   // Medium energy + balanced valence
    } else if (harshness > 0.65) {
      return 'angry';  // Medium energy + harsh = angry
    } else {
      return 'neutral';   // Default to a supported balanced mood
    }
  }
  
  // Low arousal emotions (quiet/soft sounds)
  if (arousal < 0.35) {
    if (valence < 0.4) {
      return 'sad';    // Low energy + dark = sad
    } else if (valence > 0.6) {
      return 'neutral';  // Bright but low-energy audio maps best to neutral in the supported set
    } else {
      return 'neutral';
    }
  }
  
  // Medium arousal - balanced use of valence
  if (valence > 0.6) {
    return 'happy';
  } else if (valence > 0.5) {
    return 'neutral';
  } else if (valence > 0.45) {
    return 'neutral';
  } else if (valence > 0.35) {
    return 'sad';
  } else if (harshness > 0.6) {
    return 'angry';
  } else {
    return 'sad';
  }
};

/**
 * New function: Predict mood using ML model with gender support
 */
export const predictMoodWithML = async (
  audioBlob: Blob,
  gender: Gender = 'unknown'
): Promise<{ mood: Mood; confidence: number; emotion: Emotion; mlFeatures: MLFeatures }> => {
  const result = await predictEmotion(audioBlob, gender);
  
  return {
    mood: EMOTION_TO_MOOD[result.emotion],
    confidence: result.confidence,
    emotion: result.emotion,
    mlFeatures: result.mlFeatures,
  };
};

/**
 * Get visualization data from audio for real-time display
 */
export const getVisualizationData = (audioBuffer: AudioBuffer): number[] => {
  const channelData = audioBuffer.getChannelData(0);
  const blockSize = Math.floor(channelData.length / 64);
  const result: number[] = [];
  
  for (let i = 0; i < 64; i++) {
    let sum = 0;
    for (let j = 0; j < blockSize; j++) {
      sum += Math.abs(channelData[i * blockSize + j]);
    }
    result.push(sum / blockSize);
  }
  
  return result;
};
