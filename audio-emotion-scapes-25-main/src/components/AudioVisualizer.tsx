
import React, { useMemo } from 'react';

type AudioVisualizerProps = {
  audioData: number[];
  isRecording: boolean;
  isPaused: boolean;
};

const AudioVisualizer = ({ audioData, isRecording, isPaused }: AudioVisualizerProps) => {
  // Create a subset of data for smoother visualization
  const visualizationData = useMemo(() => {
    if (!audioData.length) {
      // Return default data when no audio is detected
      return Array(30).fill(0.05);
    }
    
    // If we have data but length is too short, pad it
    if (audioData.length < 30) {
      return [...audioData, ...Array(30 - audioData.length).fill(0.05)];
    }
    
    // If we have too much data, take every nth element for cleaner visualization
    if (audioData.length > 64) {
      const step = Math.floor(audioData.length / 64);
      return Array.from({ length: 64 }, (_, i) => audioData[i * step] || 0);
    }
    
    return audioData;
  }, [audioData]);

  return (
    <div className="w-full h-full flex items-center justify-center relative">
      {/* Recording indicator */}
      {isRecording && (
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full bg-red-500 ${isPaused ? '' : 'animate-pulse'}`}></div>
          <span className="text-xs text-white/80">{isPaused ? 'PAUSED' : 'REC'}</span>
        </div>
      )}
      
      {/* Audio visualization bars */}
      <div className="flex items-center justify-center w-full h-full gap-1 px-4">
        {visualizationData.map((value, index) => {
          // Calculate height based on audio data (minimum 5%, maximum 95%)
          const height = `${Math.max(5, Math.min(95, value * 100))}%`;
          // Alternate between primary and accent colors for bars
          const baseColor = index % 2 === 0 ? 'bg-primary/80' : 'bg-accent/80';
          // Add animation class if recording and not paused
          const animationClass = isRecording && !isPaused 
            ? 'animate-wave' 
            : '';
          
          return (
            <div 
              key={index} 
              className={`h-full w-full min-w-[3px] max-w-[10px] rounded-full ${baseColor} ${animationClass}`} 
              style={{ 
                height, 
                animationDelay: `${index * 0.05}s`
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

export default AudioVisualizer;
