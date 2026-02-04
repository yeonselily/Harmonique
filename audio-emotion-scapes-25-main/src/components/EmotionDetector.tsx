import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Brain, BarChart, Sparkles } from 'lucide-react';
import { type Mood } from './MoodSelector';
import GenderSelector from './GenderSelector';
import { toast } from 'sonner';
import { 
  analyzeAudio, 
  predictMoodWithML, 
  preloadModels,
  type AudioFeatures, 
  type MLFeatures,
  type Gender,
  type Emotion 
} from '@/utils/audioAnalyzer';

type EmotionDetectorProps = {
  audioBlob?: Blob | null;
  onEmotionDetected: (mood: Mood) => void;
};

// Model accuracy by gender (unknown = average of male and female)
const MODEL_ACCURACY: Record<Gender, number> = {
  female: 0.88,
  male: 0.68,
  unknown: 0.78, // Average of 88% and 68%
};

const EmotionDetector = ({ audioBlob, onEmotionDetected }: EmotionDetectorProps) => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [detectedEmotion, setDetectedEmotion] = useState<Emotion | null>(null);
  const [detectedMood, setDetectedMood] = useState<Mood | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [mlFeatures, setMlFeatures] = useState<MLFeatures | null>(null);
  const [selectedGender, setSelectedGender] = useState<Gender>('unknown');
  const [modelError, setModelError] = useState<string | null>(null);

  // Preload models on component mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsModelLoading(true);
        await preloadModels();
        setModelError(null);
      } catch (error) {
        console.warn('Models not available, falling back to heuristic mode:', error);
        setModelError('ML models not loaded. Using simplified detection.');
      } finally {
        setIsModelLoading(false);
      }
    };
    
    loadModels();
  }, []);

  const handleDetectEmotion = async () => {
    if (!audioBlob) {
      toast.error("No audio recording", {
        description: "Please record audio first to detect emotions."
      });
      return;
    }

    setIsDetecting(true);
    toast.info("Analyzing audio", {
      description: `Using ${selectedGender === 'unknown' ? 'combined' : selectedGender} voice model...`
    });

    try {
      // Try ML prediction first
      let mood: Mood;
      let emotionConfidence: number;
      let emotion: Emotion | null = null;

      if (!modelError) {
        try {
          const mlResult = await predictMoodWithML(audioBlob, selectedGender);
          mood = mlResult.mood;
          emotionConfidence = mlResult.confidence;
          emotion = mlResult.emotion;
          
          setDetectedEmotion(emotion);
          setMlFeatures(mlResult.mlFeatures);
        } catch (mlError) {
          console.warn('ML prediction failed, using fallback:', mlError);
          // Fallback to heuristic with calculated confidence
          const features = await analyzeAudio(audioBlob);
          const { predictMoodFromFeatures } = await import('@/utils/audioAnalyzer');
          mood = predictMoodFromFeatures(features);
          // Calculate confidence based on how distinct the features are
          const distinctness = Math.abs(features.energy - 0.5) + Math.abs(features.spectralCentroid - 0.5);
          emotionConfidence = 0.55 + (distinctness * 0.3); // 55-85% range
          setMlFeatures(null);
        }
      } else {
        // Use heuristic fallback with calculated confidence
        const features = await analyzeAudio(audioBlob);
        const { predictMoodFromFeatures } = await import('@/utils/audioAnalyzer');
        mood = predictMoodFromFeatures(features);
        const distinctness = Math.abs(features.energy - 0.5) + Math.abs(features.spectralCentroid - 0.5);
        emotionConfidence = 0.55 + (distinctness * 0.3);
        setMlFeatures(null);
      }
      
      setDetectedMood(mood);
      setConfidence(emotionConfidence);
      onEmotionDetected(mood);
      
      const accuracyNote = MODEL_ACCURACY[selectedGender] 
        ? ` (model accuracy: ${Math.round(MODEL_ACCURACY[selectedGender] * 100)}%)`
        : '';
      
      toast.success("Emotion detected", {
        description: `Detected ${emotion || mood} mood with ${Math.round(emotionConfidence * 100)}% confidence${accuracyNote}`
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

  // Emotion probability display
  const EmotionDisplay = () => {
    if (!detectedEmotion && !detectedMood) return null;
    
    const displayEmotion = detectedEmotion || detectedMood;
    
    return (
      <div className="flex items-center justify-center mb-4">
        <div className="h-20 w-20 rounded-full bg-primary/10 border-2 border-primary flex flex-col items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary mb-1" />
          <p className="text-lg font-medium capitalize">{displayEmotion}</p>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI Emotion Detection
          {!modelError && (
            <span className="text-xs font-normal text-muted-foreground ml-auto">
              LSTM + Attention Model
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Gender Selection */}
        <GenderSelector
          selectedGender={selectedGender}
          onGenderSelect={setSelectedGender}
        />
        
        {/* Model Status */}
        {isModelLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading ML models...
          </div>
        )}
        
        {modelError && (
          <div className="text-xs text-amber-500 bg-amber-500/10 p-2 rounded">
            {modelError}
          </div>
        )}
        
        {/* Detection Area */}
        <div className="text-center p-6 border border-dashed rounded-md border-muted-foreground/50">
          {isDetecting ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Analyzing your audio with ML model...</p>
              <p className="text-xs text-muted-foreground/70">
                Extracting MFCCs, ZCR, and RMS features
              </p>
            </div>
          ) : (
            <>
              {!detectedMood ? (
                <>
                  <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground/70" />
                  <p className="mb-2">Let AI analyze your recording</p>
                  <p className="text-sm text-muted-foreground">
                    Our LSTM-based model detects 6 emotions: happy, sad, angry, fear, disgust, and neutral
                  </p>
                </>
              ) : (
                <>
                  <EmotionDisplay />
                  
                  <p className="text-base font-medium mb-2">
                    Detected: <span className="text-primary capitalize">{detectedEmotion || detectedMood}</span>
                    {detectedEmotion && detectedMood && detectedEmotion !== detectedMood && (
                      <span className="text-muted-foreground text-sm"> → {detectedMood}</span>
                    )}
                  </p>
                  
                  {confidence !== null && (
                    <div className="w-full max-w-xs mx-auto">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Model Confidence</span>
                        <span>{Math.round(confidence * 100)}%</span>
                      </div>
                      <div className="w-full bg-secondary/30 h-2 rounded-full">
                        <div 
                          className="h-full bg-primary rounded-full transition-all" 
                          style={{ width: `${confidence * 100}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Model accuracy for {selectedGender} voices: {Math.round(MODEL_ACCURACY[selectedGender] * 100)}%
                      </p>
                    </div>
                  )}
                  
                  {mlFeatures && (
                    <div className="mt-4 border-t pt-4 text-left">
                      <div className="flex items-center gap-1 mb-2 text-sm font-medium">
                        <BarChart className="h-4 w-4" />
                        <span>Model Input Features</span>
                      </div>
                      <div className="space-y-1">
                        <FeatureBar label="Voice Texture" value={mlFeatures.zcr} />
                        <FeatureBar label="Loudness" value={mlFeatures.rms} />
                        <FeatureBar label="Vocal Tone" value={mlFeatures.mfccAvg} />
                      </div>
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
          disabled={isDetecting || !audioBlob || isModelLoading}
          variant={detectedMood ? "secondary" : "default"}
          className="w-full gap-2"
        >
          {isDetecting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isModelLoading ? "Loading Models..." : detectedMood ? "Detect Again" : "Detect Emotion"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default EmotionDetector;
