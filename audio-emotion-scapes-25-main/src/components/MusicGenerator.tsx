
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Music, Share, Download, Play, Pause, List, RefreshCw, AudioWaveform, Settings, CheckCircle2, User, Save } from 'lucide-react';
import { type Mood } from './MoodSelector';
import { toast } from 'sonner';
import { analyzeAudio, type AudioFeatures } from '@/utils/audioAnalyzer';
import { 
  initializeTone, 
  generateMusic, 
  stopMusic, 
  isMusicPlaying, 
  renderToAudioFile 
} from '@/utils/musicGenerator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MusicCustomizer, { type MusicSettings } from './MusicCustomizer';
import JournalEntry, { type JournalEntryData } from './JournalEntry';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type GeneratedSong = {
  id: string;
  title: string;
  duration: number;
  moodType: Mood;
  blob: Blob;
  url: string;
  createdAt: Date;
};

type MusicGeneratorProps = {
  audioBlob?: Blob | null;
  selectedMood: Mood | null;
};

const MusicGenerator = ({ audioBlob, selectedMood }: MusicGeneratorProps) => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMusicUrl, setGeneratedMusicUrl] = useState<string | null>(null);
  const [originalAudioUrl, setOriginalAudioUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);
  const [processingStage, setProcessingStage] = useState<string>("waiting");
  const [generatedSongs, setGeneratedSongs] = useState<GeneratedSong[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntryData[]>([]);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [extractedFeatures, setExtractedFeatures] = useState<AudioFeatures | null>(null);
  const [activeTab, setActiveTab] = useState<string>("player");
  const [musicSettings, setMusicSettings] = useState<MusicSettings>({
    instruments: ['synth'],
    genre: 'ambient',
    complexity: 0.5,
    tempo: 0,
    reverb: 0.3
  });
  const [savedTrackCount, setSavedTrackCount] = useState(0);
  const [savedJournalCount, setSavedJournalCount] = useState(0);
  const [isSavingVariation, setIsSavingVariation] = useState(false);
  const [variationNumber, setVariationNumber] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tonePlaying = useRef<boolean>(false);
  const currentSongId = useRef<string>("");

  useEffect(() => {
    const setupToneJs = async () => {
      try {
        await initializeTone();
      } catch (err) {
        console.error("Failed to initialize tone.js:", err);
      }
    };
    
    setupToneJs();
    
    return () => {
      stopMusic();
    };
  }, []);

  useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      setOriginalAudioUrl(url);
      
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [audioBlob]);
  
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeEventListener('ended', () => setIsPlaying(false));
      audioRef.current.removeEventListener('pause', () => setIsPlaying(false));
      audioRef.current.removeEventListener('play', () => setIsPlaying(true));
    }
    
    if (generatedMusicUrl) {
      const audio = new Audio(generatedMusicUrl);
      audio.addEventListener('ended', () => setIsPlaying(false));
      audio.addEventListener('pause', () => setIsPlaying(false));
      audio.addEventListener('play', () => setIsPlaying(true));
      audioRef.current = audio;
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeEventListener('ended', () => setIsPlaying(false));
        audioRef.current.removeEventListener('pause', () => setIsPlaying(false));
        audioRef.current.removeEventListener('play', () => setIsPlaying(true));
      }
    };
  }, [generatedMusicUrl]);

  const handleGenerateMusic = async () => {
    if (!audioBlob || !selectedMood) {
      toast.error("Missing requirements", {
        description: "Please record audio and select a mood first."
      });
      return;
    }

    setIsGenerating(true);
    setProcessingStage("analyzing");
    toast.info("Generating music", {
      description: "Analyzing audio features and creating your unique music track..."
    });

    try {
      setProcessingStage("extracting");
      const features = await analyzeAudio(audioBlob);
      setExtractedFeatures(features);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setProcessingStage("generating");
      await generateMusic(selectedMood, features, musicSettings);
      
      tonePlaying.current = true;
      
      // Generate audio file
      const generatedAudioBlob = await renderToAudioFile(30);
      
      console.log(`Generated audio blob size: ${generatedAudioBlob.size} bytes`);
      
      if (generatedAudioBlob.size < 1000) {
        console.warn("Generated audio blob is too small, may be silent");
        toast.warning("Audio may not be audible", {
          description: "The generated audio file might be silent. Try playing the live version instead."
        });
      }
      
      const song: GeneratedSong = {
        id: `song-${Date.now().toString(36)}`,
        title: `${selectedMood} ${musicSettings.genre} Creation`,
        duration: 30,
        moodType: selectedMood,
        blob: generatedAudioBlob,
        url: '',
        createdAt: new Date()
      };
      
      // Store the current song ID
      currentSongId.current = song.id;
      
      if (generatedMusicUrl) {
        URL.revokeObjectURL(generatedMusicUrl);
      }
      
      const url = URL.createObjectURL(song.blob);
      song.url = url;
      
      setGeneratedMusicUrl(url);
      setGeneratedBlob(song.blob);
      setGeneratedSongs(prev => [song, ...prev].slice(0, 10));
      
      // Save to Supabase if user is logged in
      if (user) {
        try {
          let audioUrl: string | null = null;
          
          // Upload audio blob to Supabase Storage
          const fileName = `${user.id}/${song.id}.wav`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('music-tracks')
            .upload(fileName, song.blob, {
              contentType: 'audio/wav',
              upsert: true
            });
          
          if (uploadError) {
            console.warn('Could not upload audio to storage:', uploadError);
            // Continue without audio URL - track will still be saved
          } else {
            // Get public URL
            const { data: urlData } = supabase.storage
              .from('music-tracks')
              .getPublicUrl(fileName);
            audioUrl = urlData.publicUrl;
          }
          
          // Save track metadata with audio URL
          const { data: trackData, error } = await supabase.from('music_tracks').insert({
            user_id: user.id,
            title: song.title,
            mood: selectedMood as any,
            audio_features: extractedFeatures as any,
            music_settings: musicSettings as any,
            audio_blob_url: audioUrl,
          }).select('id').single();
          
          if (error) {
            console.error('Error saving track to Supabase:', error);
            toast.success("Music generated", {
              description: "Ready to play! (Could not save to profile)"
            });
          } else if (trackData) {
            // Update the current song ID to the database ID for journal linking
            currentSongId.current = trackData.id;
            setSavedTrackCount(prev => prev + 1);
            toast.success("Music generated & saved!", {
              description: `Track #${savedTrackCount + 1} saved to your profile. You can find it later in your profile history.`
            });
          }
        } catch (err) {
          console.error('Error saving track:', err);
          toast.success("Music generated", {
            description: "Ready to play! (Save failed)"
          });
        }
      } else {
        toast.success("Music generated", {
          description: "Sign in to save tracks to your profile."
        });
      }
    } catch (error) {
      console.error("Error generating music:", error);
      toast.error("Generation failed", {
        description: "There was an error generating your music. Please try again."
      });
    } finally {
      setIsGenerating(false);
      setProcessingStage("complete");
    }
  };

  const handlePlayPause = () => {
    if (tonePlaying.current) {
      stopMusic();
      tonePlaying.current = false;
      setIsPlaying(false);
      return;
    }
    
    if (!audioRef.current || !generatedMusicUrl) {
      if (extractedFeatures && selectedMood) {
        generateMusic(selectedMood, extractedFeatures, musicSettings).then(() => {
          tonePlaying.current = true;
          setIsPlaying(true);
        }).catch(err => {
          console.error("Error playing procedural music:", err);
        });
      }
      return;
    }
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      try {
        if (!audioRef.current.src || audioRef.current.src !== generatedMusicUrl) {
          audioRef.current.src = generatedMusicUrl;
          audioRef.current.load();
        }
        
        const playPromise = audioRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            console.error('Error playing audio:', err);
            toast.error("Playback error", {
              description: "Could not play the audio. Please try again."
            });
          });
        }
      } catch (err) {
        console.error('Error setting up audio playback:', err);
        toast.error("Audio setup error", {
          description: "There was a problem setting up audio playback."
        });
      }
    }
  };

  const handleShare = async () => {
    if (!generatedBlob) {
      toast.error("Nothing to share", { 
        description: "Please generate music first."
      });
      return;
    }

    setIsSharing(true);
    
    try {
      if (navigator.share) {
        try {
          const file = new File([generatedBlob], `${selectedMood}-music-creation.wav`, { 
            type: 'audio/wav' 
          });
          
          await navigator.share({
            title: `My ${selectedMood} Music Creation`,
            text: `Check out the music I created with Audio Emotion Scapes!`,
            files: [file]
          });
          toast.success("Shared successfully");
        } catch (err) {
          console.error("Web Share API error:", err);
          await navigator.clipboard.writeText("Your music has been generated! (This is a demo link)");
          toast.info("Sharing link copied", {
            description: "The link to your music has been copied to clipboard."
          });
        }
      } else {
        await navigator.clipboard.writeText("Your music has been generated! (This is a demo link)");
        toast.info("Sharing link copied", {
          description: "The link to your music has been copied to clipboard."
        });
      }
    } catch (error) {
      console.error("Error sharing:", error);
      toast.error("Sharing failed", {
        description: "There was an error sharing your music. Please try again."
      });
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownload = () => {
    if (!generatedMusicUrl || !selectedMood) return;
    
    const a = document.createElement('a');
    a.href = generatedMusicUrl;
    a.download = `${selectedMood}-${musicSettings.genre}-music-creation.wav`;
    a.click();
    
    toast.success("Music downloaded", {
      description: "Your generated music has been saved to your device."
    });
  };

  const togglePlaylist = () => {
    setShowPlaylist(!showPlaylist);
  };

  const playSongFromPlaylist = (song: GeneratedSong) => {
    if (tonePlaying.current) {
      stopMusic();
      tonePlaying.current = false;
    }
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    if (generatedMusicUrl && generatedMusicUrl !== song.url) {
      URL.revokeObjectURL(generatedMusicUrl);
    }
    
    const audio = new Audio(song.url);
    audio.addEventListener('ended', () => setIsPlaying(false));
    audio.addEventListener('pause', () => setIsPlaying(false));
    audio.addEventListener('play', () => setIsPlaying(true));
    audioRef.current = audio;
    
    try {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.error('Error playing audio from playlist:', err);
          toast.error("Playback error", {
            description: "Could not play the selected song. Please try again."
          });
        });
      }
      
      setIsPlaying(true);
      setGeneratedMusicUrl(song.url);
      setGeneratedBlob(song.blob);
      currentSongId.current = song.id;
      
      toast.info("Now playing", {
        description: `Playing ${song.title}`
      });
    } catch (err) {
      console.error('Error setting up playlist audio:', err);
      toast.error("Audio setup error", {
        description: "There was a problem setting up audio playback."
      });
    }
  };

  const regenerateVariation = async () => {
    if (!selectedMood || !extractedFeatures) {
      toast.error("Cannot create variation", {
        description: "Please generate music first before creating variations."
      });
      return;
    }
    
    toast.info("Creating variation", {
      description: "Playing a new variation (not saved yet - click 'Save' to keep it)"
    });
    
    if (tonePlaying.current) {
      stopMusic();
      tonePlaying.current = false;
    }
    
    try {
      const variationFeatures = { ...extractedFeatures };
      variationFeatures.energy = Math.min(1, Math.max(0, variationFeatures.energy + (Math.random() * 0.4 - 0.2)));
      variationFeatures.spectralCentroid = Math.min(1, Math.max(0, variationFeatures.spectralCentroid + (Math.random() * 0.4 - 0.2)));
      
      await generateMusic(selectedMood, variationFeatures, musicSettings);
      tonePlaying.current = true;
      setIsPlaying(true);
      setVariationNumber(prev => prev + 1);
      
    } catch (err) {
      console.error("Error creating variation:", err);
      toast.error("Variation failed", {
        description: "There was an error creating a music variation."
      });
    }
  };

  // Save current playing variation as a new track
  const saveCurrentVariation = async () => {
    if (!selectedMood || !extractedFeatures) {
      toast.error("Nothing to save", {
        description: "Generate music first before saving."
      });
      return;
    }

    setIsSavingVariation(true);
    toast.info("Saving variation", {
      description: "Recording and saving your current variation..."
    });

    try {
      // Render current music to audio file
      const generatedAudioBlob = await renderToAudioFile(30);
      
      const song: GeneratedSong = {
        id: `song-${Date.now().toString(36)}`,
        title: `${selectedMood} ${musicSettings.genre} v${variationNumber + 1}`,
        duration: 30,
        moodType: selectedMood,
        blob: generatedAudioBlob,
        url: '',
        createdAt: new Date()
      };

      const url = URL.createObjectURL(song.blob);
      song.url = url;

      // Update local state
      if (generatedMusicUrl) {
        URL.revokeObjectURL(generatedMusicUrl);
      }
      setGeneratedMusicUrl(url);
      setGeneratedBlob(song.blob);
      setGeneratedSongs(prev => [song, ...prev].slice(0, 10));

      // Save to Supabase if logged in
      if (user) {
        try {
          let audioUrl: string | null = null;
          
          const fileName = `${user.id}/${song.id}.wav`;
          const { error: uploadError } = await supabase.storage
            .from('music-tracks')
            .upload(fileName, song.blob, {
              contentType: 'audio/wav',
              upsert: true
            });
          
          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('music-tracks')
              .getPublicUrl(fileName);
            audioUrl = urlData.publicUrl;
          }
          
          const { data: trackData, error } = await supabase.from('music_tracks').insert({
            user_id: user.id,
            title: song.title,
            mood: selectedMood as any,
            audio_features: extractedFeatures as any,
            music_settings: musicSettings as any,
            audio_blob_url: audioUrl,
          }).select('id').single();
          
          if (!error && trackData) {
            currentSongId.current = trackData.id;
            setSavedTrackCount(prev => prev + 1);
            toast.success("Variation saved!", {
              description: `"${song.title}" saved to your profile.`
            });
          } else {
            toast.success("Variation recorded", {
              description: "Saved locally. Could not sync to profile."
            });
          }
        } catch (err) {
          console.error('Error saving variation:', err);
          toast.success("Variation recorded locally", {
            description: "Could not save to profile."
          });
        }
      } else {
        toast.success("Variation recorded", {
          description: "Sign in to save permanently to your profile."
        });
      }
    } catch (err) {
      console.error("Error saving variation:", err);
      toast.error("Save failed", {
        description: "Could not save the variation."
      });
    } finally {
      setIsSavingVariation(false);
    }
  };
  
  const handleSettingsChange = (settings: MusicSettings) => {
    setMusicSettings(settings);
  };
  
  const handleSaveJournalEntry = (entry: JournalEntryData) => {
    entry.associatedSongId = currentSongId.current;
    setJournalEntries(prev => [entry, ...prev]);
    if (user) {
      setSavedJournalCount(prev => prev + 1);
    }
  };

  const WaveformVisual = () => (
    <div className="flex items-center justify-center h-10">
      {[...Array(16)].map((_, i) => (
        <div 
          key={i}
          className="w-1 mx-0.5 bg-primary animate-pulse rounded-full"
          style={{
            height: `${15 + Math.sin(i / 2) * 10 + Math.random() * 10}px`,
            animationDelay: `${i * 0.1}s`,
            opacity: isPlaying ? 1 : 0.4
          }}
        ></div>
      ))}
    </div>
  );

  const filteredJournalEntries = journalEntries.filter(
    entry => entry.associatedSongId === currentSongId.current
  );

  return (
    <Card className="relative">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="h-5 w-5" />
          Music Generation
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {originalAudioUrl && (
          <div className="p-4 bg-secondary/10 rounded-md">
            <p className="mb-2 font-medium">Your Original Recording</p>
            <audio 
              controls 
              className="w-full" 
              src={originalAudioUrl}
              onError={(e) => {
                console.error("Error with original audio playback:", e);
              }}
            ></audio>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="player" className="text-sm">
              Player
            </TabsTrigger>
            <TabsTrigger value="customize" className="text-sm">
              Customize
            </TabsTrigger>
            <TabsTrigger value="journal" className="text-sm">
              Journal
            </TabsTrigger>
          </TabsList>

          <TabsContent value="player" className="space-y-4">
            {!isGenerating && tonePlaying.current ? (
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-md text-center">
                <p className="mb-2 font-medium">Live {selectedMood} Music</p>
                <WaveformVisual />
                <p className="text-xs mt-2 text-muted-foreground">
                  Procedurally generated music using Tone.js
                </p>
              </div>
            ) : null}
            
            {!generatedMusicUrl && !tonePlaying.current ? (
              <div className="text-center p-6 border border-dashed rounded-md border-muted-foreground/50">
                {isGenerating ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">
                      {processingStage === "analyzing" && "Analyzing audio features..."}
                      {processingStage === "extracting" && "Extracting audio characteristics..."}
                      {processingStage === "generating" && `Creating your unique ${selectedMood} track...`}
                    </p>
                    <div className="w-full max-w-xs bg-secondary/30 h-2 rounded-full mt-2">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ 
                          width: processingStage === "analyzing" ? "33%" : 
                                 processingStage === "extracting" ? "66%" : 
                                 processingStage === "generating" ? "90%" : "0%" 
                        }}
                      ></div>
                    </div>
                    <p className="text-xs text-muted-foreground/70 mt-2">
                      Using Tone.js and audio features to create music based on your recording
                    </p>
                  </div>
                ) : (
                  <>
                    <Music className="h-12 w-12 mx-auto mb-4 text-muted-foreground/70" />
                    <p className="mb-2">Ready to transform your recording into music</p>
                    <p className="text-sm text-muted-foreground">
                      Our AI will generate a unique track based on your audio and selected {selectedMood} mood
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {generatedMusicUrl && (
                  <div className="p-4 bg-secondary/20 rounded-md">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">Your {selectedMood} Music Creation</p>
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="gap-2"
                        onClick={handleDownload}
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                    </div>
                    <audio 
                      controls 
                      className="w-full" 
                      src={generatedMusicUrl}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                      onError={(e) => {
                        console.error("Error with generated audio playback:", e);
                        toast.error("Audio playback issue", {
                          description: "There was a problem playing the generated audio."
                        });
                      }}
                    ></audio>
                    <div className="flex items-center gap-2 mt-2">
                      {user ? (
                        <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Saved to your profile
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Sign in to save tracks permanently
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Live variation indicator */}
                {tonePlaying.current && variationNumber > 0 && !generatedMusicUrl && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md text-center">
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Playing Variation #{variationNumber} (live preview - not saved yet)
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Click "Save This Version" to keep it
                    </p>
                  </div>
                )}

                <div className="flex justify-center gap-2 flex-wrap">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2"
                    onClick={handlePlayPause}
                  >
                    {(isPlaying || tonePlaying.current) ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {(isPlaying || tonePlaying.current) ? "Pause" : "Play"}
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2"
                    onClick={regenerateVariation}
                    disabled={!selectedMood || !extractedFeatures}
                    title="Creates a new variation (live preview only)"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Try New Variation
                  </Button>
                  
                  {/* Save button - prominently shown when there's something to save */}
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="gap-2"
                    onClick={saveCurrentVariation}
                    disabled={isSavingVariation || !selectedMood || !extractedFeatures}
                    title="Record and save current music to your profile"
                  >
                    {isSavingVariation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isSavingVariation ? "Saving..." : "Save This Version"}
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2"
                    onClick={handleShare}
                    disabled={isSharing || (!generatedBlob && !tonePlaying.current)}
                  >
                    {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share className="h-4 w-4" />}
                    Share
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2"
                    onClick={togglePlaylist}
                  >
                    <List className="h-4 w-4" />
                    {showPlaylist ? "Hide History" : "Session History"}
                  </Button>
                </div>
                
                {/* Help text explaining the workflow */}
                <div className="text-xs text-muted-foreground text-center space-y-1">
                  <p><strong>Try New Variation</strong> = Preview different versions (live, not saved)</p>
                  <p><strong>Save This Version</strong> = Record current music and save to profile</p>
                </div>
                
                {/* Session History - shows songs generated in this session */}
                {showPlaylist && generatedSongs.length > 0 && (
                  <div className="mt-4 border rounded-md">
                    <div className="p-3 bg-secondary/10 border-b font-medium flex items-center justify-between">
                      <span>This Session's Music</span>
                      <span className="text-xs text-muted-foreground">{generatedSongs.length} track(s)</span>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      <ul className="divide-y">
                        {generatedSongs.map((song) => (
                          <li key={song.id} className="p-3 hover:bg-secondary/20 transition-colors">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{song.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {song.moodType} • {new Date(song.createdAt).toLocaleTimeString()}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => playSongFromPlaylist(song)}
                                  className="h-8 w-8 p-0"
                                  title="Play"
                                >
                                  <Play className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => {
                                    const a = document.createElement('a');
                                    a.href = song.url;
                                    a.download = `${song.moodType}-${song.title}.wav`;
                                    a.click();
                                    toast.success("Downloaded", { description: song.title });
                                  }}
                                  className="h-8 w-8 p-0"
                                  title="Download"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                
                {extractedFeatures && (
                  <div className="p-4 rounded-md border border-border mt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AudioWaveform className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium">Audio Characteristics Used</p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <div>Energy: {Math.round(extractedFeatures.energy * 100)}%</div>
                      <div>Brightness: {Math.round(extractedFeatures.spectralCentroid * 100)}%</div>
                      <div>Complexity: {Math.round((1-extractedFeatures.spectralFlatness) * 100)}%</div>
                      <div>Tempo: {extractedFeatures.tempo || 120} BPM</div>
                      <div>Intensity: {Math.round(extractedFeatures.rms * 100)}%</div>
                      <div>Texture: {extractedFeatures.zcr > 0.5 ? 'Rough' : 'Smooth'}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="customize">
            <MusicCustomizer 
              onSettingsChange={handleSettingsChange}
              detectedTempo={extractedFeatures?.tempo}
            />
          </TabsContent>
          
          <TabsContent value="journal">
            <JournalEntry 
              onSave={handleSaveJournalEntry} 
              currentSongId={currentSongId.current}
              existingEntries={filteredJournalEntries} 
            />
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="flex-col gap-3">
        {!tonePlaying.current && !generatedMusicUrl && (
          <Button 
            onClick={handleGenerateMusic} 
            disabled={isGenerating || !audioBlob || !selectedMood}
            className="w-full gap-2"
          >
            {isGenerating && <Loader2 className="h-4 w-4 animate-spin" />}
            Generate Music
          </Button>
        )}
        
        {/* Session Save Status */}
        {user && (savedTrackCount > 0 || savedJournalCount > 0) && (
          <div className="w-full p-3 bg-green-500/10 border border-green-500/20 rounded-md">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">Saved to Your Profile</span>
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              {savedTrackCount > 0 && `${savedTrackCount} music track${savedTrackCount > 1 ? 's' : ''}`}
              {savedTrackCount > 0 && savedJournalCount > 0 && ' • '}
              {savedJournalCount > 0 && `${savedJournalCount} journal entr${savedJournalCount > 1 ? 'ies' : 'y'}`}
              {' — '}accessible anytime from your profile
            </p>
          </div>
        )}
        
        {!user && generatedMusicUrl && (
          <div className="w-full p-3 bg-amber-500/10 border border-amber-500/20 rounded-md">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <User className="h-4 w-4" />
              <span className="text-sm font-medium">Not Signed In</span>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Your music is only saved for this session. Sign in to save tracks permanently and access them later.
            </p>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

export default MusicGenerator;
