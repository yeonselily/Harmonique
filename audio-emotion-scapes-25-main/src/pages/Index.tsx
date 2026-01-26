import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Headphones, Mic, Share2, AudioWaveform, LogIn, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AudioRecorder from '@/components/AudioRecorder';
import MoodSelector, { type Mood } from '@/components/MoodSelector';
import MusicGenerator from '@/components/MusicGenerator';
import EmotionDetector from '@/components/EmotionDetector';
import AuthModal from '@/components/AuthModal';
import { toast } from 'sonner';
import { initializeTone } from '@/utils/musicGenerator';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

const Index = () => {
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [aiSuggestedMood, setAiSuggestedMood] = useState<Mood | null>(null);
  const [activeTab, setActiveTab] = useState('record');
  const [audioEngineReady, setAudioEngineReady] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  const { user, loading, signOut } = useAuth();
  
  useEffect(() => {
    const setupAudioEngine = async () => {
      try {
        await initializeTone();
        setAudioEngineReady(true);
      } catch (error) {
        console.error("Failed to initialize audio engine:", error);
        toast.error("Audio engine initialization failed", {
          description: "There was an error setting up the audio processing engine. Some features might not work properly."
        });
      }
    };
    
    setupAudioEngine();
  }, []);

  const handleRecordingComplete = (blob: Blob) => {
    setRecordingBlob(blob);
    setActiveTab('mood');
    toast.success("Audio recorded", {
      description: "Now select a mood for your music generation"
    });
  };

  const handleMoodSelect = (mood: Mood) => {
    setSelectedMood(mood);
    setActiveTab('generate');
  };

  const handleEmotionDetected = (mood: Mood) => {
    setAiSuggestedMood(mood);
    toast.info("AI mood suggestion", {
      description: `Based on your audio, we suggest a '${mood}' mood. You can use this or choose another.`
    });
  };

  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const recordingInfo = recordingBlob ? {
    size: formatFileSize(recordingBlob.size),
    type: recordingBlob.type,
    lastModified: new Date().toLocaleString()
  } : null;

  const getMoodGradient = () => {
    if (!selectedMood) return 'bg-gradient-to-r from-blue-500/20 to-purple-500/20';
    
    switch (selectedMood) {
      case 'happy': 
        return 'bg-gradient-to-r from-yellow-400/30 to-amber-500/30';
      case 'sad': 
        return 'bg-gradient-to-r from-indigo-400/30 to-purple-500/30';
      case 'angry': 
        return 'bg-gradient-to-r from-red-500/30 to-rose-600/30';
      case 'fear': 
        return 'bg-gradient-to-r from-purple-400/30 to-violet-500/30';
      case 'disgust': 
        return 'bg-gradient-to-r from-green-400/30 to-emerald-500/30';
      case 'neutral': 
        return 'bg-gradient-to-r from-gray-400/30 to-slate-500/30';
      default: 
        return 'bg-gradient-to-r from-blue-500/20 to-purple-500/20';
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      // Error handling is done in the auth context
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AudioWaveform className="h-8 w-8 text-primary mx-auto animate-pulse" />
          <p className="mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className={`p-6 ${getMoodGradient()} transition-colors duration-1000`}>
        <div className="container">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AudioWaveform className="h-8 w-8 text-primary" />
              <h1 className="text-2xl md:text-4xl font-bold">
                Harmonique
              </h1>
            </div>
            
            <div className="flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">{user.email}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleSignOut}>
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline ml-2">Sign Out</span>
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setShowAuthModal(true)}>
                  <LogIn className="h-4 w-4" />
                  <span className="hidden sm:inline ml-2">Sign In</span>
                </Button>
              )}
            </div>
          </div>
          
          <p className="text-center mt-2 max-w-xl mx-auto">
            Transform your voice recordings into unique music tracks based on emotions
          </p>
          
          {!user && (
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-primary underline"
                  onClick={() => setShowAuthModal(true)}
                >
                  Sign in
                </Button>
                {" "}to save your music creations and journal entries
              </p>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 container max-w-4xl py-8 px-4">
        {!audioEngineReady && (
          <Card className="mb-6 border-yellow-500/50 bg-yellow-500/10">
            <CardContent className="p-4 text-center">
              <p className="text-amber-600 dark:text-amber-400">
                Initializing audio engine... Some features may not be available yet.
              </p>
            </CardContent>
          </Card>
        )}
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="grid grid-cols-3 mb-8">
            <TabsTrigger value="record" className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              <span className="hidden sm:inline">Record</span>
            </TabsTrigger>
            <TabsTrigger value="mood" className="flex items-center gap-2" disabled={!recordingBlob}>
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Select Mood</span>
            </TabsTrigger>
            <TabsTrigger value="generate" className="flex items-center gap-2" disabled={!selectedMood || !recordingBlob}>
              <Headphones className="h-4 w-4" />
              <span className="hidden sm:inline">Generate</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="record" className="space-y-8">
            <div className="prose max-w-none dark:prose-invert mb-6">
              <h2 className="text-2xl font-bold">Record Your Audio</h2>
              <p>
                Record at least 30 seconds of audio. You can record your voice, ambient sounds,
                beatboxing, or any audio that expresses your current mood.
              </p>
            </div>
            
            <AudioRecorder onRecordingComplete={handleRecordingComplete} minRecordingTime={30} />
            
            {recordingInfo && (
              <div className="text-sm text-muted-foreground">
                <p>Recording saved: {recordingInfo.type} ({recordingInfo.size})</p>
                <p>Created: {recordingInfo.lastModified}</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="mood" className="space-y-8">
            <div className="prose max-w-none dark:prose-invert mb-6">
              <h2 className="text-2xl font-bold">Choose Your Mood</h2>
              <p>
                Select a mood for your music generation or let our AI detect the emotion in your recording.
              </p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <MoodSelector 
                  selectedMood={selectedMood}
                  onMoodSelect={handleMoodSelect}
                  aiSuggestedMood={aiSuggestedMood}
                />
              </div>
              <div>
                <EmotionDetector 
                  audioBlob={recordingBlob}
                  onEmotionDetected={handleEmotionDetected}
                />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="generate" className="space-y-8">
            <div className="prose max-w-none dark:prose-invert mb-6">
              <h2 className="text-2xl font-bold">Generate Your Music</h2>
              <p>
                Transform your audio into a unique music track based on your selected {selectedMood} mood.
              </p>
              <div className="text-sm bg-yellow-100 dark:bg-yellow-900/30 p-4 rounded-md mt-4">
                <h3 className="font-medium text-amber-800 dark:text-amber-300">About This Technology</h3>
                <p className="text-amber-700 dark:text-amber-400">
                  This application uses Web Audio API for audio analysis and Tone.js for music generation.
                  The emotion detection extracts audio features to identify the mood in your recording.
                </p>
                <p className="text-amber-700 dark:text-amber-400 mt-2">
                  The music generator creates procedural music based on your recording's characteristics
                  and your selected mood using synthesizers and digital signal processing.
                </p>
              </div>
            </div>
            
            <MusicGenerator 
              audioBlob={recordingBlob}
              selectedMood={selectedMood}
            />
          </TabsContent>
        </Tabs>
      </main>
      
      <footer className="bg-background py-6 border-t border-border">
        <div className="container text-center text-sm text-muted-foreground">
          <p>Harmonique - Transform your emotions into music</p>
          <p className="text-xs mt-2">Powered by Web Audio API, Meyda.js, and Tone.js</p>
        </div>
      </footer>
      
      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
    </div>
  );
};

export default Index;
