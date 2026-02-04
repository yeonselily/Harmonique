
import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BookOpenText, Save, Plus, Trash, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface JournalEntryData {
  id: string;
  content: string;
  createdAt: Date;
  associatedSongId?: string;
}

interface JournalEntryProps {
  onSave: (entry: JournalEntryData) => void;
  currentSongId?: string;
  existingEntries: JournalEntryData[];
}

const JournalEntry = ({ onSave, currentSongId, existingEntries }: JournalEntryProps) => {
  const { user } = useAuth();
  const [entryContent, setEntryContent] = useState('');
  const [showEntries, setShowEntries] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveEntry = async () => {
    if (!entryContent.trim()) {
      toast.error("Cannot save empty entry", {
        description: "Please write something in your journal before saving."
      });
      return;
    }

    setIsSaving(true);

    const newEntry: JournalEntryData = {
      id: `entry-${Date.now().toString(36)}`,
      content: entryContent,
      createdAt: new Date(),
      associatedSongId: currentSongId
    };

    // Save to Supabase if user is logged in
    if (user) {
      try {
        const { error } = await supabase.from('journal_entries').insert({
          user_id: user.id,
          content: entryContent,
          associated_track_id: currentSongId || null,
        });
        
        if (error) {
          console.error('Error saving journal entry:', error);
          toast.error("Failed to save to cloud", {
            description: "Entry saved locally but couldn't sync to cloud."
          });
        }
      } catch (err) {
        console.error('Error saving journal:', err);
      }
    }

    onSave(newEntry);
    setEntryContent('');
    setIsSaving(false);
    
    toast.success("Journal entry saved", {
      description: user ? "Your thoughts have been saved to your profile." : "Sign in to save entries to your profile."
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpenText className="h-5 w-5" />
            Journal Entry
          </div>
          {existingEntries.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowEntries(!showEntries)}
              className="text-xs"
            >
              {showEntries ? 'Hide' : 'Show'} Past Entries ({existingEntries.length})
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {showEntries && existingEntries.length > 0 && (
          <div className="mb-4 border rounded-md overflow-hidden">
            <div className="bg-secondary/30 px-3 py-2 text-sm font-medium">Past Entries</div>
            <div className="max-h-40 overflow-y-auto divide-y">
              {existingEntries.map((entry) => (
                <div key={entry.id} className="p-3 text-sm">
                  <p className="whitespace-pre-wrap">{entry.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <Textarea
            placeholder="Write your thoughts, feelings, or reflections while listening to your music..."
            className="min-h-[120px] resize-none"
            value={entryContent}
            onChange={(e) => setEntryContent(e.target.value)}
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          variant="default" 
          className="w-full flex gap-2 items-center"
          onClick={handleSaveEntry}
          disabled={isSaving}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSaving ? "Saving..." : "Save Journal Entry"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default JournalEntry;
