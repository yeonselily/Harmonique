import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Smile, Meh, Frown, Angry, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Updated to match the 6 emotions the ML model can detect
export type Mood = 'happy' | 'sad' | 'angry' | 'fear' | 'disgust' | 'neutral';

type MoodOption = {
  value: Mood;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  className: string;
};

type MoodSelectorProps = {
  selectedMood: Mood | null;
  onMoodSelect: (mood: Mood) => void;
  aiSuggestedMood?: Mood | null;
};

const MoodSelector = ({ selectedMood, onMoodSelect, aiSuggestedMood }: MoodSelectorProps) => {
  // Define mood options matching the 6 emotions from the ML model
  const moods: MoodOption[] = [
    {
      value: 'happy',
      label: 'Happy',
      icon: Smile,
      description: 'Joyful, cheerful',
      className: 'border-yellow-400/30 bg-yellow-500/10 hover:bg-yellow-500/20',
    },
    {
      value: 'sad',
      label: 'Sad',
      icon: Frown,
      description: 'Melancholic, sorrowful',
      className: 'border-blue-400/30 bg-blue-500/10 hover:bg-blue-500/20',
    },
    {
      value: 'angry',
      label: 'Angry',
      icon: Angry,
      description: 'Intense, frustrated',
      className: 'border-red-400/30 bg-red-500/10 hover:bg-red-500/20',
    },
    {
      value: 'fear',
      label: 'Fear',
      icon: AlertTriangle,
      description: 'Anxious, worried',
      className: 'border-purple-400/30 bg-purple-500/10 hover:bg-purple-500/20',
    },
    {
      value: 'disgust',
      label: 'Disgust',
      icon: XCircle,
      description: 'Aversion, displeasure',
      className: 'border-green-400/30 bg-green-500/10 hover:bg-green-500/20',
    },
    {
      value: 'neutral',
      label: 'Neutral',
      icon: Meh,
      description: 'Calm, balanced',
      className: 'border-gray-400/30 bg-gray-500/10 hover:bg-gray-500/20',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detected Emotions</CardTitle>
        <CardDescription>
          {aiSuggestedMood 
            ? 'AI detected emotion shown below. You can also select manually.'
            : 'Record audio to detect emotion, or select manually.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup 
          className="grid grid-cols-2 md:grid-cols-3 gap-3"
          value={selectedMood || undefined}
          onValueChange={(value) => onMoodSelect(value as Mood)}
        >
          {moods.map((mood) => {
            const isSelected = selectedMood === mood.value;
            const isAiSuggested = aiSuggestedMood === mood.value;
            
            return (
              <div key={mood.value} className="relative">
                <RadioGroupItem
                  value={mood.value}
                  id={`mood-${mood.value}`}
                  className="peer sr-only"
                />
                <Label
                  htmlFor={`mood-${mood.value}`}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-lg border-2 p-4 cursor-pointer transition-all",
                    "hover:border-primary/50",
                    isSelected 
                      ? "border-primary bg-primary/10" 
                      : mood.className,
                    isAiSuggested && !isSelected
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                      : "",
                    "peer-focus-visible:ring-1 peer-focus-visible:ring-primary"
                  )}
                >
                  {isAiSuggested && (
                    <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-medium">
                      AI
                    </div>
                  )}
                  <mood.icon className={cn(
                    "mb-2 h-7 w-7",
                    isSelected ? "text-primary" : "text-muted-foreground"
                  )} />
                  <div className={cn(
                    "font-medium text-sm",
                    isSelected ? "text-primary" : ""
                  )}>
                    {mood.label}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 text-center">
                    {mood.description}
                  </div>
                </Label>
              </div>
            );
          })}
        </RadioGroup>
      </CardContent>
    </Card>
  );
};

export default MoodSelector;
