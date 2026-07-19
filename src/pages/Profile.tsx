import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Music, BookOpenText, User, Play, Pause, Calendar, Trash2, Plus, Mic, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface MusicTrack {
  id: string;
  title: string;
  mood: string;
  created_at: string;
  audio_blob_url: string | null;
  original_recording_url?: string | null;
}

interface JournalEntry {
  id: string;
  content: string;
  created_at: string;
  associated_track_id: string | null;
}

interface CombinedSession {
  track: MusicTrack;
  journals: JournalEntry[];
}

const Profile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<CombinedSession[]>([]);
  const [orphanJournals, setOrphanJournals] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const generatedAudioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const [resolvingTrackId, setResolvingTrackId] = useState<string | null>(null);
  const STORAGE_BUCKET = 'music-tracks';

  const getGeneratedTrackPath = (userId: string, trackId: string) => `${userId}/${trackId}.webm`;
  const getOriginalRecordingPath = (userId: string, trackId: string) => `${userId}/${trackId}-original.webm`;
  const extractStoragePath = (value: string | null | undefined) => {
    if (!value) return null;
    if (!value.startsWith('http')) return value;

    try {
      const url = new URL(value);
      const marker = `/${STORAGE_BUCKET}/`;
      const index = url.pathname.indexOf(marker);
      if (index === -1) return null;
      return decodeURIComponent(url.pathname.slice(index + marker.length));
    } catch {
      return null;
    }
  };

  const getStoredGeneratedPath = (track: MusicTrack) => {
    return extractStoragePath(track.audio_blob_url) || getGeneratedTrackPath(user!.id, track.id);
  };

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    
    fetchUserData();
  }, [user, navigate]);

  useEffect(() => {
    return () => {
      Object.values(generatedAudioRefs.current).forEach((audio) => audio?.pause());
    };
  }, []);

  const fetchUserData = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      // Fetch music tracks with audio URLs
      const { data: tracks, error: tracksError } = await supabase
        .from('music_tracks')
        .select('id, title, mood, created_at, audio_blob_url')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (tracksError) {
        console.error('Error fetching tracks:', tracksError);
      }
      
      // Fetch journal entries with track associations
      const { data: entries, error: entriesError } = await supabase
        .from('journal_entries')
        .select('id, content, created_at, associated_track_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (entriesError) {
        console.error('Error fetching entries:', entriesError);
      }

      // Combine tracks with their journal entries
      const trackList = tracks || [];
      const entryList = entries || [];

      const trackListWithAudio = await Promise.all(
        trackList.map(async (track) => {
          let generatedAudioUrl: string | null = null;
          let originalRecordingUrl: string | null = null;

          const generatedPath = getStoredGeneratedPath(track);
          const { data, error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(generatedPath, 60 * 60);

          if (!error && data?.signedUrl) {
            generatedAudioUrl = data.signedUrl;
          } else if (error) {
            console.warn('Error creating generated track URL:', error);
          }

          const originalPath = getOriginalRecordingPath(user.id, track.id);
          const { data: originalData, error: originalError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(originalPath, 60 * 60);

          if (!originalError && originalData?.signedUrl) {
            originalRecordingUrl = originalData.signedUrl;
          }

          return {
            ...track,
            audio_blob_url: generatedAudioUrl,
            original_recording_url: originalRecordingUrl,
          };
        })
      );
      
      const combined: CombinedSession[] = trackListWithAudio.map(track => ({
        track,
        journals: entryList.filter(e => e.associated_track_id === track.id)
      }));
      
      // Find journals without associated tracks
      const orphans = entryList.filter(e => 
        !e.associated_track_id || !trackListWithAudio.find(t => t.id === e.associated_track_id)
      );
      
      setSessions(combined);
      setOrphanJournals(orphans);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTrack = async (track: MusicTrack) => {
    if (!user) return;
    
    setDeleting(track.id);
    
    try {
      // Stop audio if this track's player is open
      if (activeTrackId === track.id) {
        generatedAudioRefs.current[track.id]?.pause();
        setPlayingTrackId(null);
        setActiveTrackId(null);
      }

      const generatedPath = getStoredGeneratedPath(track);
      const originalPath = getOriginalRecordingPath(user.id, track.id);
      await supabase.storage.from(STORAGE_BUCKET).remove([generatedPath, originalPath]);

      // Delete associated journal entries first (foreign key constraint)
      const { error: journalDeleteError } = await supabase
        .from('journal_entries')
        .delete()
        .eq('associated_track_id', track.id);
      if (journalDeleteError) {
        console.error('Error deleting associated journals:', journalDeleteError);
        toast.error("Delete failed", {
          description: journalDeleteError.message || "Could not delete associated journals"
        });
        return;
      }

      // Delete track from database
      const { error } = await supabase
        .from('music_tracks')
        .delete()
        .eq('id', track.id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting track:', error);
        toast.error("Delete failed", {
          description: error.message || "Could not delete track"
        });
      } else {
        // Update local state and refresh from server to avoid stale data
        setSessions(prev => prev.filter(s => s.track.id !== track.id));
        await fetchUserData();
      }
    } catch (err) {
      console.error('Error deleting track:', err);
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteJournal = async (journalId: string, isOrphan: boolean = false) => {
    if (!user) return;
    
    setDeleting(journalId);
    
    try {
      const { error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', journalId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting journal:', error);
        toast.error("Delete failed", {
          description: error.message || "Could not delete journal entry"
        });
      } else {
        if (isOrphan) {
          setOrphanJournals(prev => prev.filter(j => j.id !== journalId));
        } else {
          // Update journals within sessions
          setSessions(prev => prev.map(session => ({
            ...session,
            journals: session.journals.filter(j => j.id !== journalId)
          })));
        }
        await fetchUserData();
      }
    } catch (err) {
      console.error('Error deleting journal:', err);
    } finally {
      setDeleting(null);
    }
  };

  const handlePlayPause = async (track: MusicTrack) => {
    // Toggle pause/play on the already-open player (single audio element)
    if (activeTrackId === track.id) {
      const el = generatedAudioRefs.current[track.id];
      if (!el) return;

      if (!el.paused) {
        el.pause();
        setPlayingTrackId(null);
      } else {
        try {
          await el.play();
          setPlayingTrackId(track.id);
        } catch (err) {
          console.error('Error playing audio:', err);
          toast.error("Playback error", {
            description: err instanceof Error ? err.message : "Could not play audio"
          });
        }
      }
      return;
    }

    // Stop whichever track was open before
    if (activeTrackId) {
      generatedAudioRefs.current[activeTrackId]?.pause();
    }

    let audioUrl: string | null = track.audio_blob_url;

    try {
      setResolvingTrackId(track.id);
      const fileName = getStoredGeneratedPath(track);
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(fileName, 60 * 60);

      if (error || !data?.signedUrl) {
        console.error('Error creating signed URL:', error);
        toast.error("Cannot play track", {
          description: error?.message || "Audio file not found in storage"
        });
        return;
      }

      audioUrl = data.signedUrl;
      setSessions(prev => prev.map(session => (
        session.track.id === track.id
          ? { ...session, track: { ...session.track, audio_blob_url: audioUrl } }
          : session
      )));
    } catch (err) {
      console.error('Error resolving track URL:', err);
      toast.error("Cannot load audio", {
        description: err instanceof Error ? err.message : "Unknown error"
      });
      return;
    } finally {
      setResolvingTrackId(null);
    }

    if (!audioUrl) return;

    setActiveTrackId(track.id);
    setPlayingTrackId(track.id);
  };

  const getMoodColor = (mood: string) => {
    const colors: Record<string, string> = {
      happy: 'bg-yellow-500/20 text-yellow-600',
      sad: 'bg-blue-500/20 text-blue-600',
      angry: 'bg-red-500/20 text-red-600',
      fear: 'bg-purple-500/20 text-purple-600',
      disgust: 'bg-green-500/20 text-green-600',
      neutral: 'bg-gray-500/20 text-gray-600',
    };
    return colors[mood] || 'bg-gray-500/20 text-gray-600';
  };

  const OriginalRecordingPlayer = ({ url }: { url: string }) => {
    const [loadError, setLoadError] = useState(false);

    if (loadError) {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
            <span>Original recording unavailable</span>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Mic className="h-3.5 w-3.5" />
          <span>Original recording</span>
        </div>
        <audio
          controls
          className="w-full h-8"
          src={url}
          onError={() => setLoadError(true)}
        />
      </div>
    );
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="p-6 border-b">
        <div className="container max-w-4xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <User className="h-6 w-6 text-primary" />
                <div>
                  <h1 className="text-xl font-bold">Your Profile</h1>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>
            </div>
            <Button onClick={() => navigate('/')} className="gap-2">
              <Plus className="h-4 w-4" />
              Create New
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl py-8 px-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-5 w-5" />
              Your Music Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Loading...</p>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8">
                <Music className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No music sessions yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Go back and create some music to see it here!
                </p>
                <Button onClick={() => navigate('/')} className="mt-4 gap-2">
                  <Plus className="h-4 w-4" />
                  Create Your First Track
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map(({ track, journals }) => (
                  <div key={track.id} className="border rounded-lg p-4 space-y-3">
                    {/* Track Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium truncate">{track.title}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full capitalize shrink-0 ${getMoodColor(track.mood)}`}>
                            {track.mood}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(track.created_at).toLocaleDateString()}</span>
                          <span>{new Date(track.created_at).toLocaleTimeString()}</span>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePlayPause(track)}
                          className="gap-1"
                          disabled={resolvingTrackId === track.id}
                        >
                          {playingTrackId === track.id ? (
                            <><Pause className="h-4 w-4" /> Pause</>
                          ) : (
                            <><Play className="h-4 w-4" /> Play</>
                          )}
                        </Button>
                        
                        <AlertDialog>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  disabled={deleting === track.id}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Delete this track and its journals permanently.</p>
                            </TooltipContent>
                          </Tooltip>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this track?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete "{track.title}", its generated music file, its original recording, and all associated journal entries. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteTrack(track)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    
                    {/* Generated Track Player — single audio element controlled by Play/Pause */}
                    {activeTrackId === track.id && track.audio_blob_url && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Generated track</p>
                        <audio
                          ref={(el) => {
                            generatedAudioRefs.current[track.id] = el;
                          }}
                          controls
                          className="w-full h-8"
                          src={track.audio_blob_url}
                          autoPlay
                          onPlay={() => setPlayingTrackId(track.id)}
                          onPause={() => {
                            setPlayingTrackId((current) => (current === track.id ? null : current));
                          }}
                          onEnded={() => setPlayingTrackId(null)}
                          onError={() => {
                            setPlayingTrackId(null);
                            setActiveTrackId(null);
                            toast.error("Cannot play generated track", {
                              description: "The audio file may be missing or corrupted. Try deleting and re-generating."
                            });
                          }}
                        />
                      </div>
                    )}

                    {track.original_recording_url && (
                      <OriginalRecordingPlayer url={track.original_recording_url} />
                    )}
                    
                    {/* Associated Journal Entries */}
                    {journals.length > 0 && (
                      <div className="border-t pt-3 mt-3">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                          <BookOpenText className="h-3 w-3" />
                          <span>Journal {journals.length > 1 ? 'entries' : 'entry'}</span>
                        </div>
                        <div className="space-y-2">
                          {journals.map(journal => (
                            <div key={journal.id} className="bg-muted/30 rounded p-2 text-sm flex items-start gap-2">
                              <p className="whitespace-pre-wrap flex-1">{journal.content}</p>
                              <AlertDialog>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-muted-foreground hover:text-destructive h-6 w-6 p-0 shrink-0"
                                        disabled={deleting === journal.id}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </AlertDialogTrigger>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Delete this journal entry.</p>
                                  </TooltipContent>
                                </Tooltip>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete this journal entry?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteJournal(journal.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Orphan Journal Entries (without associated tracks) */}
        {orphanJournals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpenText className="h-5 w-5" />
                Other Journal Entries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {orphanJournals.map(entry => (
                  <div key={entry.id} className="border rounded-lg p-3 flex items-start gap-2">
                    <div className="flex-1">
                      <p className="whitespace-pre-wrap text-sm">{entry.content}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(entry.created_at).toLocaleDateString()} at{' '}
                        {new Date(entry.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <AlertDialog>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-destructive shrink-0"
                              disabled={deleting === entry.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete this journal entry.</p>
                        </TooltipContent>
                      </Tooltip>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this journal entry?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteJournal(entry.id, true)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Profile;
