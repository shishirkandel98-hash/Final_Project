import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pencil, Trash2, Plus } from "lucide-react";

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export const NotesPanel = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (editing) {
        const { error } = await supabase
          .from('notes')
          .update({ title, content })
          .eq('id', editing);

        if (error) throw error;
        toast.success("Note updated successfully");
      } else {
        const { error } = await supabase
          .from('notes')
          .insert({ user_id: user.id, title, content });

        if (error) throw error;
        toast.success("Note created successfully");
      }

      setTitle("");
      setContent("");
      setEditing(null);
      setShowForm(false);
      fetchNotes();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleEdit = (note: Note) => {
    setEditing(note.id);
    setTitle(note.title);
    setContent(note.content);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this note?")) return;

    try {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) throw error;
      toast.success("Note deleted successfully");
      fetchNotes();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleCancel = () => {
    setTitle("");
    setContent("");
    setEditing(null);
    setShowForm(false);
  };

  if (loading) {
    return <div>Loading notes...</div>;
  }

  return (
    <div className="space-y-4">
      {!showForm && (
        <Button onClick={() => setShowForm(true)} className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          New Note
        </Button>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Edit Note" : "New Note"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                placeholder="Note Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <Textarea
                placeholder="Write your daily update..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
              />
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {editing ? "Update" : "Save"}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {notes.map((note) => (
          <Card key={note.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-lg">{note.title}</CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleEdit(note)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(note.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {note.content}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Updated: {new Date(note.updated_at).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};