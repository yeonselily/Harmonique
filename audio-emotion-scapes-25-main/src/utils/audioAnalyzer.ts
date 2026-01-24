
import { type Mood } from '@/components/MoodSelector';
import Meyda from 'meyda';

// Audio features we want to extract
export interface AudioFeatures {
  energy: number;
  spectralCentroid: number;
  spectralFlatness: number;
  spectralRolloff: number;
  zcr: number;
  rms: number;
  tempo?: number;
}

// Default features if analysis fails
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
 * Analyzes audio blob to extract meaningful features
 */
export const analyzeAudio = async (audioBlob: Blob): Promise<AudioFeatures> => {
  try {
    console.log("Starting enhanced audio analysis...");
    
    // Create audio context and decode audio
    const audioContext = new window.AudioContext();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Get audio data for analysis
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    // Create offline analyzer
    const analyzerNode = audioContext.createAnalyser();
    analyzerNode.fftSize = 2048;
    
    // For better results, we'll analyze chunks of audio data
    const chunkSize = Math.min(16384, channelData.length);
    const chunksCount = Math.floor(channelData.length / chunkSize);
    
    // Initialize features
    let energySum = 0;
    let centroidSum = 0;
    let flatnessSum = 0;
    let rolloffSum = 0;
    let zcrSum = 0;
    let rmsSum = 0;
    
    // Analyze chunks
    for (let i = 0; i < chunksCount; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, channelData.length);
      const chunk = channelData.slice(start, end);
      
      // Create temporary buffer for this chunk
      const tempBuffer = audioContext.createBuffer(1, chunk.length, sampleRate);
      tempBuffer.getChannelData(0).set(chunk);
      
      // Create source for offline analysis
      const tempSource = audioContext.createBufferSource();
      tempSource.buffer = tempBuffer;
      
      // Connect to analyzer
      tempSource.connect(analyzerNode);
      
      // Use Meyda to extract features from this chunk
      // Cast to any to work with the library's types
      const features = Meyda.extract([
        'energy', 
        'spectralCentroid', 
        'spectralFlatness', 
        'spectralRolloff',
        'zcr', 
        'rms'
      ], chunk) as any;
      
      // Sum features for averaging later
      energySum += features.energy || 0;
      centroidSum += features.spectralCentroid || 0;
      flatnessSum += features.spectralFlatness || 0;
      rolloffSum += features.spectralRolloff || 0;
      zcrSum += features.zcr || 0;
      rmsSum += features.rms || 0;
    }
    
    // Calculate average features
    const results: AudioFeatures = {
      energy: energySum / chunksCount / 100,
      spectralCentroid: centroidSum / chunksCount / 5000, // Normalize to 0-1 range
      spectralFlatness: flatnessSum / chunksCount,
      spectralRolloff: rolloffSum / chunksCount / 22050, // Normalize to 0-1 range
      zcr: zcrSum / chunksCount / 1000, // Normalize
      rms: rmsSum / chunksCount * 10, // Boost RMS for better visibility
      tempo: estimateTempo(channelData, sampleRate),
    };
    
    // Clamp values between 0-1
    Object.keys(results).forEach(key => {
      if (key !== 'tempo') {
        results[key as keyof AudioFeatures] = Math.min(1, Math.max(0, results[key as keyof AudioFeatures] as number));
      }
    });
    
    console.log("Audio analysis results:", results);
    return results;
  } catch (error) {
    console.error("Error in audio analysis:", error);
    return defaultFeatures;
  }
};

/**
 * Attempt to estimate tempo from audio data using onset detection
 */
const estimateTempo = (audioData: Float32Array, sampleRate: number): number => {
  try {
    // Simple energy-based onset detection
    const hopSize = 512;
    const bufferSize = 1024;
    const energyThreshold = 0.01;
    const onsets: number[] = [];
    
    // Calculate energy in windows and detect onsets
    for (let i = 0; i < audioData.length - bufferSize; i += hopSize) {
      let energy = 0;
      
      // Calculate energy in this frame
      for (let j = 0; j < bufferSize; j++) {
        energy += Math.abs(audioData[i + j]);
      }
      energy /= bufferSize;
      
      // If energy above threshold, mark as onset
      if (energy > energyThreshold) {
        // And previous frame was below threshold (to avoid multiple detections)
        if (i > 0) {
          let prevEnergy = 0;
          for (let j = 0; j < bufferSize; j++) {
            prevEnergy += Math.abs(audioData[i - hopSize + j]);
          }
          prevEnergy /= bufferSize;
          
          if (energy > prevEnergy * 1.2) {
            onsets.push(i / sampleRate);
          }
        }
      }
    }
    
    // Calculate intervals between onsets
    const intervals: number[] = [];
    for (let i = 1; i < onsets.length; i++) {
      const interval = onsets[i] - onsets[i - 1];
      if (interval > 0.1 && interval < 1.0) { // Between 60 and 600 BPM
        intervals.push(interval);
      }
    }
    
    // Find the average interval
    if (intervals.length > 0) {
      const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
      const tempo = Math.round(60 / avgInterval);
      return Math.max(60, Math.min(200, tempo)); // Clamp between 60-200 BPM
    }
    
    return 120; // Default tempo if estimation fails
  } catch (error) {
    console.error("Error estimating tempo:", error);
    return 120;
  }
};

/**
 * Predict mood based on audio features
 */
export const predictMoodFromFeatures = (features: AudioFeatures): Mood => {
  // Simple rule-based classifier based on audio features
  // In a real application, this would be an ML model
  
  const { energy, spectralCentroid, spectralFlatness, zcr, rms } = features;
  
  // High energy + high spectral content = energetic or angry
  if (energy > 0.7) {
    if (spectralCentroid > 0.6 && zcr > 0.6) {
      return 'angry'; // High frequency content with high energy suggests anger
    } else {
      return 'energetic'; // High energy but more balanced spectrum suggests energetic
    }
  }
  
  // Low energy could be sad or calm
  if (energy < 0.4) {
    if (spectralCentroid < 0.4 && spectralFlatness < 0.3) {
      return 'sad'; // Low energy, low frequency content suggests sadness
    } else {
      return 'calm'; // Low energy but more balanced spectrum suggests calm
    }
  }
  
  // Medium energy with high brightness suggests happiness
  if (energy > 0.4 && energy < 0.7 && spectralCentroid > 0.5 && rms > 0.4) {
    return 'happy';
  }
  
  // Default mood if no clear pattern
  return 'calm';
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
