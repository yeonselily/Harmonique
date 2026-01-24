import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Smile, Music, Frown, Angry, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Mood = 'happy' | 'calm' | 'energetic' | 'sad' | 'angry';

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
  // Define mood options with their properties
  const moods: MoodOption[] = [
    {
      value: 'happy',
      label: 'Happy',
      icon: Smile,
      description: 'Cheerful, upbeat vibes',
      className: 'border-yellow-400/30 bg-yellow-500/10 hover:bg-yellow-500/20',
    },
    {
      value: 'calm',
      label: 'Calm',
      icon: Music,
      description: 'Peaceful, relaxing tones',
      className: 'border-blue-400/30 bg-blue-500/10 hover:bg-blue-500/20',
    },
    {
      value: 'energetic',
      label: 'Energetic',
      icon: Zap,
      description: 'Dynamic, motivating beats',
      className: 'border-orange-400/30 bg-orange-500/10 hover:bg-orange-500/20',
    },
    {
      value: 'sad',
      label: 'Sad',
      icon: Frown,
      description: 'Melancholic, emotional melodies',
      className: 'border-indigo-400/30 bg-indigo-500/10 hover:bg-indigo-500/20',
    },
    {
      value: 'angry',
      label: 'Angry',
      icon: Angry,
      description: 'Intense, powerful rhythms',
      className: 'border-red-400/30 bg-red-500/10 hover:bg-red-500/20',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a Mood</CardTitle>
        <CardDescription>
          Select the mood for your music or {aiSuggestedMood && 'use our AI-suggested mood'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup 
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
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
                    "flex flex-col items-center justify-center rounded-md border-2 p-4 cursor-pointer transition-all",
                    "hover:border-primary",
                    isSelected 
                      ? "border-primary bg-primary/10" 
                      : mood.className,
                    "peer-focus-visible:ring-1 peer-focus-visible:ring-primary"
                  )}
                >
                  {isAiSuggested && (
                    <div className="absolute -top-2 -right-2 bg-primary text-white text-xs px-2 py-1 rounded-full">
                      AI Suggested
                    </div>
                  )}
                  <mood.icon className={cn(
                    "mb-2 h-8 w-8",
                    isSelected ? "text-primary" : ""
                  )} />
                  <div className="font-medium">{mood.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{mood.description}</div>
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
