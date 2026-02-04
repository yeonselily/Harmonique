import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Music, BookOpenText, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface MusicTrack {
  id: string;
  title: string;
  mood: string;
  created_at: string;
}

interface JournalEntry {
  id: string;
  content: string;
  created_at: string;
}

const Profile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    
    fetchUserData();
  }, [user, navigate]);

  const fetchUserData = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      // Fetch music tracks
      const { data: tracks, error: tracksError } = await supabase
        .from('music_tracks')
        .select('id, title, mood, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (tracksError) {
        console.error('Error fetching tracks:', tracksError);
      } else {
        setMusicTracks(tracks || []);
      }
      
      // Fetch journal entries
      const { data: entries, error: entriesError } = await supabase
        .from('journal_entries')
        .select('id, content, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (entriesError) {
        console.error('Error fetching entries:', entriesError);
      } else {
        setJournalEntries(entries || []);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="p-6 border-b">
        <div className="container max-w-4xl">
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
        </div>
      </header>

      <main className="container max-w-4xl py-8 px-4">
        <Tabs defaultValue="music" className="space-y-6">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="music" className="flex items-center gap-2">
              <Music className="h-4 w-4" />
              Music History
            </TabsTrigger>
            <TabsTrigger value="journal" className="flex items-center gap-2">
              <BookOpenText className="h-4 w-4" />
              Journal Entries
            </TabsTrigger>
          </TabsList>

          <TabsContent value="music">
            <Card>
              <CardHeader>
                <CardTitle>Your Generated Music</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-center text-muted-foreground py-8">Loading...</p>
                ) : musicTracks.length === 0 ? (
                  <div className="text-center py-8">
                    <Music className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-muted-foreground">No music generated yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Go back and create some music to see it here!
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {musicTracks.map((track) => (
                      <div key={track.id} className="py-4">
                        <p className="font-medium">{track.title}</p>
                        <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                          <span className="capitalize">{track.mood}</span>
                          <span>{new Date(track.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="journal">
            <Card>
              <CardHeader>
                <CardTitle>Your Journal Entries</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-center text-muted-foreground py-8">Loading...</p>
                ) : journalEntries.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpenText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-muted-foreground">No journal entries yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Write your thoughts while creating music!
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {journalEntries.map((entry) => (
                      <div key={entry.id} className="py-4">
                        <p className="whitespace-pre-wrap">{entry.content}</p>
                        <p className="text-sm text-muted-foreground mt-2">
                          {new Date(entry.created_at).toLocaleDateString()} at{' '}
                          {new Date(entry.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Profile;
