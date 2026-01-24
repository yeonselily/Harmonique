
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Brain, BarChart } from 'lucide-react';
import { type Mood } from './MoodSelector';
import { toast } from 'sonner';
import { analyzeAudio, predictMoodFromFeatures, type AudioFeatures } from '@/utils/audioAnalyzer';

type EmotionDetectorProps = {
  audioBlob?: Blob | null;
  onEmotionDetected: (mood: Mood) => void;
};

const EmotionDetector = ({ audioBlob, onEmotionDetected }: EmotionDetectorProps) => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedEmotion, setDetectedEmotion] = useState<Mood | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [audioFeatures, setAudioFeatures] = useState<AudioFeatures | null>(null);

  const handleDetectEmotion = async () => {
    if (!audioBlob) {
      toast.error("No audio recording", {
        description: "Please record audio first to detect emotions."
      });
      return;
    }

    setIsDetecting(true);
    toast.info("Analyzing audio", {
      description: "Extracting audio features and detecting emotions..."
    });

    try {
      // Use our enhanced audio analyzer
      const features = await analyzeAudio(audioBlob);
      setAudioFeatures(features);
      
      // Predict mood based on extracted features
      const mood = predictMoodFromFeatures(features);
      
      // Calculate confidence based on feature clarity
      // Higher variance in features = higher confidence
      const featureValues = Object.values(features).filter(val => typeof val === 'number' && val !== features.tempo);
      const avg = featureValues.reduce((sum, val) => sum + (val as number), 0) / featureValues.length;
      const variance = featureValues.reduce((sum, val) => sum + Math.pow((val as number) - avg, 2), 0) / featureValues.length;
      const calculatedConfidence = Math.min(0.95, 0.6 + variance * 10);
      
      setDetectedEmotion(mood);
      setConfidence(calculatedConfidence);
      onEmotionDetected(mood);
      
      toast.success("Emotion detected", {
        description: `We detected a ${mood} mood in your recording with ${Math.round(calculatedConfidence * 100)}% confidence.`
      });
    } catch (error) {
      console.error("Error detecting emotion:", error);
      toast.error("Detection failed", {
        description: "There was an error analyzing your audio. Please try again."
      });
    } finally {
      setIsDetecting(false);
    }
  };

  // Feature display component
  const FeatureBar = ({ label, value }: { label: string; value: number }) => (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span>{label}</span>
        <span>{Math.round(value * 100)}%</span>
      </div>
      <div className="w-full bg-secondary/30 h-1.5 rounded-full">
        <div 
          className="h-full bg-primary rounded-full" 
          style={{ width: `${value * 100}%` }}
        ></div>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI Emotion Detection
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center p-6 border border-dashed rounded-md border-muted-foreground/50">
          {isDetecting ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Analyzing your audio to detect emotions...</p>
              <p className="text-xs text-muted-foreground/70">
                Extracting audio features and processing with enhanced SER model
              </p>
            </div>
          ) : (
            <>
              {!detectedEmotion ? (
                <>
                  <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground/70" />
                  <p className="mb-2">Let AI analyze your recording</p>
                  <p className="text-sm text-muted-foreground">
                    Our emotion detection extracts audio features to analyze your voice and sounds
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center mb-4">
                    <div className="h-16 w-16 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
                      <p className="text-lg font-medium capitalize">{detectedEmotion}</p>
                    </div>
                  </div>
                  
                  <p className="text-base font-medium mb-4">
                    Detected mood: <span className="text-primary capitalize">{detectedEmotion}</span>
                  </p>
                  
                  {confidence && (
                    <div className="w-full bg-secondary/30 h-2 rounded-full mt-2 mb-4">
                      <div 
                        className="h-full bg-primary rounded-full" 
                        style={{ width: `${confidence * 100}%` }}
                      ></div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {Math.round(confidence * 100)}% confidence score
                      </p>
                    </div>
                  )}
                  
                  {audioFeatures && (
                    <div className="mt-4 border-t pt-4">
                      <div className="flex items-center gap-1 mb-2 text-sm font-medium">
                        <BarChart className="h-4 w-4" />
                        <span>Extracted Audio Features</span>
                      </div>
                      <FeatureBar label="Energy" value={audioFeatures.energy} />
                      <FeatureBar label="Brightness" value={audioFeatures.spectralCentroid} />
                      <FeatureBar label="Complexity" value={1 - audioFeatures.spectralFlatness} />
                      <FeatureBar label="Intensity" value={audioFeatures.rms} />
                      
                      {audioFeatures.tempo && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Estimated tempo: {audioFeatures.tempo} BPM
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleDetectEmotion} 
          disabled={isDetecting || !audioBlob}
          variant={detectedEmotion ? "secondary" : "default"}
          className="w-full gap-2"
        >
          {isDetecting && <Loader2 className="h-4 w-4 animate-spin" />}
          {detectedEmotion ? "Detect Again" : "Detect Emotion"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default EmotionDetector;
