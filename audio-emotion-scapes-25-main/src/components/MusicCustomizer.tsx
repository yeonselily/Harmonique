import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Music, Sliders, Piano, Guitar, Headphones, Drum, HelpCircle, ChevronDown } from 'lucide-react';

export interface MusicSettings {
  instruments: string[];
  genre: string;
  complexity: number;
  tempo: number;
  reverb: number;
}

const defaultSettings: MusicSettings = {
  instruments: ['synth'],
  genre: 'ambient',
  complexity: 0.5,
  tempo: 0,  // will be adjusted based on detected tempo
  reverb: 0.3
};

interface MusicCustomizerProps {
  onSettingsChange: (settings: MusicSettings) => void;
  detectedTempo?: number;
}

const MusicCustomizer = ({ onSettingsChange, detectedTempo }: MusicCustomizerProps) => {
  const [settings, setSettings] = useState<MusicSettings>(defaultSettings);
  const [helpOpen, setHelpOpen] = useState(false);
  
  const handleInstrumentToggle = (instrument: string) => {
    setSettings(prev => {
      const updatedInstruments = prev.instruments.includes(instrument) 
        ? prev.instruments.filter(i => i !== instrument)
        : [...prev.instruments, instrument];
      
      // Always keep at least one instrument
      const finalInstruments = updatedInstruments.length === 0 ? ['synth'] : updatedInstruments;
      
      const updatedSettings = {
        ...prev,
        instruments: finalInstruments
      };
      
      onSettingsChange(updatedSettings);
      return updatedSettings;
    });
  };

  const handleGenreChange = (genre: string) => {
    setSettings(prev => {
      const updatedSettings = {
        ...prev,
        genre
      };
      onSettingsChange(updatedSettings);
      return updatedSettings;
    });
  };

  const handleComplexityChange = (value: number[]) => {
    setSettings(prev => {
      const updatedSettings = {
        ...prev,
        complexity: value[0]
      };
      onSettingsChange(updatedSettings);
      return updatedSettings;
    });
  };

  const handleTempoChange = (value: number[]) => {
    setSettings(prev => {
      const updatedSettings = {
        ...prev,
        tempo: value[0]
      };
      onSettingsChange(updatedSettings);
      return updatedSettings;
    });
  };

  const handleReverbChange = (value: number[]) => {
    setSettings(prev => {
      const updatedSettings = {
        ...prev,
        reverb: value[0]
      };
      onSettingsChange(updatedSettings);
      return updatedSettings;
    });
  };

  const getBaseTempo = () => {
    if (settings.tempo === 0 && detectedTempo) {
      return detectedTempo;
    } else if (settings.tempo === 0) {
      return 120;
    }
    return settings.tempo;
  };

  const getInstrumentBtnClassName = (instrument: string) => {
    const isActive = settings.instruments.includes(instrument);
    return `p-2 flex flex-col items-center gap-1 text-xs rounded-md transition-all ${
      isActive 
        ? 'bg-primary text-primary-foreground' 
        : 'bg-secondary hover:bg-secondary/80'
    }`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sliders className="h-5 w-5" />
            Music Customization
          </CardTitle>
          <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground">
                <HelpCircle className="h-4 w-4" />
                <span className="text-xs">Help</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${helpOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>
        <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
          <CollapsibleContent>
            <div className="mt-3 p-3 bg-muted/50 rounded-md text-xs text-muted-foreground space-y-2">
              <p><strong>Defaults:</strong> Synth only, Ambient genre, 50% complexity, auto tempo, 30% reverb</p>
              <p><strong>How it works:</strong> Changes apply when you generate new music. Toggle instruments, pick a genre, and adjust sliders to customize your sound.</p>
              <p><strong>Tip:</strong> Higher complexity = more notes and chords. Tempo at 0 = auto-detect from your recording.</p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-2 text-sm font-medium">Instruments</div>
          <div className="grid grid-cols-3 gap-2">
            <Button 
              type="button" 
              variant="ghost" 
              className={getInstrumentBtnClassName('synth')}
              onClick={() => handleInstrumentToggle('synth')}
            >
              <Music className="h-4 w-4 mb-1" />
              Synth
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              className={getInstrumentBtnClassName('piano')}
              onClick={() => handleInstrumentToggle('piano')}
            >
              <Piano className="h-4 w-4 mb-1" />
              Piano
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              className={getInstrumentBtnClassName('guitar')}
              onClick={() => handleInstrumentToggle('guitar')}
            >
              <Guitar className="h-4 w-4 mb-1" />
              Guitar
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              className={getInstrumentBtnClassName('bass')}
              onClick={() => handleInstrumentToggle('bass')}
            >
              <Headphones className="h-4 w-4 mb-1" />
              Bass
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              className={getInstrumentBtnClassName('drums')}
              onClick={() => handleInstrumentToggle('drums')}
            >
              <Drum className="h-4 w-4 mb-1" />
              Drums
            </Button>
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium">Genre</div>
          <Select 
            value={settings.genre} 
            onValueChange={handleGenreChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a genre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ambient">Ambient</SelectItem>
              <SelectItem value="electronic">Electronic</SelectItem>
              <SelectItem value="classical">Classical</SelectItem>
              <SelectItem value="jazz">Jazz</SelectItem>
              <SelectItem value="pop">Pop</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Complexity</span>
            <span className="text-xs text-muted-foreground">
              {Math.round(settings.complexity * 100)}%
            </span>
          </div>
          <Slider 
            value={[settings.complexity]} 
            onValueChange={handleComplexityChange}
            min={0.1}
            max={1}
            step={0.05}
          />
        </div>
        
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Tempo Adjustment</span>
            <span className="text-xs text-muted-foreground">
              {settings.tempo === 0 ? 'Auto' : `${Math.round(getBaseTempo())} BPM`}
            </span>
          </div>
          <Slider 
            value={[settings.tempo]} 
            onValueChange={handleTempoChange}
            min={0}
            max={200}
            step={5}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {settings.tempo === 0 ? 'Using detected tempo from your recording' : 'Custom tempo'}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Reverb</span>
            <span className="text-xs text-muted-foreground">
              {Math.round(settings.reverb * 100)}%
            </span>
          </div>
          <Slider 
            value={[settings.reverb]} 
            onValueChange={handleReverbChange}
            min={0}
            max={1}
            step={0.05}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default MusicCustomizer;
