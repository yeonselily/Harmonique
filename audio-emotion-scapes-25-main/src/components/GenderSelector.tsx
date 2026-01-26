import React from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { Gender } from '@/utils/audioAnalyzer';

type GenderOption = {
  value: Gender;
  label: string;
  accuracy: number;
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
      accuracy: 88,
    },
    {
      value: 'male',
      label: 'Male',
      accuracy: 68,
    },
    {
      value: 'unknown',
      label: 'Any',
      accuracy: 78, // Average of 88% and 68%
    },
  ];

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Voice:</span>
        <RadioGroup
          className="flex gap-1"
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
                {option.label} ({option.accuracy}%)
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
        <h4 className="text-sm font-medium">Voice Type</h4>
        <span className="text-xs text-muted-foreground">
          Select for better accuracy
        </span>
      </div>
      
      <RadioGroup
        className="grid grid-cols-3 gap-2"
        value={selectedGender}
        onValueChange={(value) => onGenderSelect(value as Gender)}
      >
        {options.map((option) => {
          const isSelected = selectedGender === option.value;
          
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
                <span className={cn(
                  "text-sm font-medium",
                  isSelected ? "text-primary" : ""
                )}>
                  {option.label}
                </span>
                <span className={cn(
                  "text-lg font-bold mt-1",
                  isSelected ? "text-primary" : "text-muted-foreground",
                  option.accuracy >= 85 ? "text-green-500" : option.accuracy >= 70 ? "text-yellow-500" : "text-orange-500"
                )}>
                  {option.accuracy}%
                </span>
              </Label>
            </div>
          );
        })}
      </RadioGroup>
    </div>
  );
};

export default GenderSelector;
