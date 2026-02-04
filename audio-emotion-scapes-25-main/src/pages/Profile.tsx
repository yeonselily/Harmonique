import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Music, BookOpenText, User, Play, Pause, Calendar, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    
    fetchUserData();
  }, [user, navigate]);

  useEffect(() => {
    // Cleanup audio on unmount
    return () => {
      if (audioRef) {
        audioRef.pause();
      }
    };
  }, [audioRef]);

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
      
      const combined: CombinedSession[] = trackList.map(track => ({
        track,
        journals: entryList.filter(e => e.associated_track_id === track.id)
      }));
      
      // Find journals without associated tracks
      const orphans = entryList.filter(e => 
        !e.associated_track_id || !trackList.find(t => t.id === e.associated_track_id)
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
      // Stop audio if playing
      if (playingTrackId === track.id && audioRef) {
        audioRef.pause();
        setPlayingTrackId(null);
      }

      // Delete from storage if exists
      if (track.audio_blob_url) {
        const fileName = `${user.id}/${track.id}.wav`;
        await supabase.storage.from('music-tracks').remove([fileName]);
      }

      // Delete associated journal entries first (foreign key constraint)
      await supabase
        .from('journal_entries')
        .delete()
        .eq('associated_track_id', track.id);

      // Delete track from database
      const { error } = await supabase
        .from('music_tracks')
        .delete()
        .eq('id', track.id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting track:', error);
      } else {
        // Update local state
        setSessions(prev => prev.filter(s => s.track.id !== track.id));
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
      }
    } catch (err) {
      console.error('Error deleting journal:', err);
    } finally {
      setDeleting(null);
    }
  };

  const handlePlayPause = (track: MusicTrack) => {
    if (!track.audio_blob_url) return;

    if (playingTrackId === track.id && audioRef) {
      // Pause current track
      audioRef.pause();
      setPlayingTrackId(null);
    } else {
      // Stop any playing audio
      if (audioRef) {
        audioRef.pause();
      }
      
      // Play new track
      const audio = new Audio(track.audio_blob_url);
      audio.addEventListener('ended', () => setPlayingTrackId(null));
      audio.play();
      setAudioRef(audio);
      setPlayingTrackId(track.id);
    }
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
                        {track.audio_blob_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePlayPause(track)}
                            className="gap-1"
                          >
                            {playingTrackId === track.id ? (
                              <><Pause className="h-4 w-4" /> Pause</>
                            ) : (
                              <><Play className="h-4 w-4" /> Play</>
                            )}
                          </Button>
                        )}
                        
                        <AlertDialog>
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
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this track?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete "{track.title}" and all associated journal entries. This action cannot be undone.
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
                    
                    {/* Audio Player (if playing) */}
                    {playingTrackId === track.id && track.audio_blob_url && (
                      <audio 
                        controls 
                        className="w-full h-8" 
                        src={track.audio_blob_url}
                        autoPlay
                        onEnded={() => setPlayingTrackId(null)}
                      />
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
