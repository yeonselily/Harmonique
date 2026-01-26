import React from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { User, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Gender } from '@/utils/audioAnalyzer';

type GenderOption = {
  value: Gender;
  label: string;
  description: string;
  accuracy: string;
  icon: React.ComponentType<{ className?: string }>;
};

type GenderSelectorProps = {
  selectedGender: Gender;
  onGenderSelect: (gender: Gender) => void;
  compact?: boolean;
};

const GenderSelector = ({ selectedGender, onGenderSelect, compact = false }: GenderSelectorProps) => {
  const options: GenderOption[] = [
    {
      value: 'female',
      label: 'Female',
      description: 'Optimized for female voices',
      accuracy: '88% accuracy',
      icon: User,
    },
    {
      value: 'male',
      label: 'Male',
      description: 'Optimized for male voices',
      accuracy: '68% accuracy',
      icon: User,
    },
    {
      value: 'unknown',
      label: 'Any / Prefer not to say',
      description: 'Gender-neutral model',
      accuracy: 'Lower accuracy',
      icon: Users,
    },
  ];

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Voice type:</span>
        <RadioGroup
          className="flex gap-2"
          value={selectedGender}
          onValueChange={(value) => onGenderSelect(value as Gender)}
        >
          {options.map((option) => (
            <div key={option.value} className="flex items-center">
              <RadioGroupItem
                value={option.value}
                id={`gender-compact-${option.value}`}
                className="peer sr-only"
              />
              <Label
                htmlFor={`gender-compact-${option.value}`}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-full cursor-pointer transition-all border",
                  selectedGender === option.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/30 hover:bg-secondary/50 border-transparent"
                )}
              >
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Select Voice Type</h4>
        <span className="text-xs text-muted-foreground">
          For better accuracy
        </span>
      </div>
      
      <RadioGroup
        className="grid grid-cols-3 gap-3"
        value={selectedGender}
        onValueChange={(value) => onGenderSelect(value as Gender)}
      >
        {options.map((option) => {
          const isSelected = selectedGender === option.value;
          const Icon = option.icon;
          
          return (
            <div key={option.value}>
              <RadioGroupItem
                value={option.value}
                id={`gender-${option.value}`}
                className="peer sr-only"
              />
              <Label
                htmlFor={`gender-${option.value}`}
                className={cn(
                  "flex flex-col items-center justify-center rounded-lg border-2 p-3 cursor-pointer transition-all",
                  "hover:border-primary/50",
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-muted bg-secondary/10"
                )}
              >
                <Icon className={cn(
                  "h-5 w-5 mb-1",
                  isSelected ? "text-primary" : "text-muted-foreground"
                )} />
                <span className={cn(
                  "text-sm font-medium",
                  isSelected ? "text-primary" : ""
                )}>
                  {option.label}
                </span>
                <span className={cn(
                  "text-xs mt-0.5",
                  isSelected ? "text-primary/80" : "text-muted-foreground"
                )}>
                  {option.accuracy}
                </span>
              </Label>
            </div>
          );
        })}
      </RadioGroup>
      
      <p className="text-xs text-muted-foreground text-center">
        The female model has the highest accuracy. Select "Any" if you prefer not to specify.
      </p>
    </div>
  );
};

export default GenderSelector;
