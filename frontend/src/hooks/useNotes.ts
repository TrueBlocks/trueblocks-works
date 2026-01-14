import { useState, useCallback, useEffect } from 'react';
import {
  GetNotes,
  CreateNote,
  UpdateNote,
  DeleteNote,
  UndeleteNote,
  DeleteNotePermanent,
} from '@app';
import { models } from '@models';
import { LogErr } from '@/utils';

interface UseNotesResult {
  notes: models.Note[];
  loading: boolean;
  handleAdd: (noteText: string) => Promise<void>;
  handleUpdate: (note: models.Note) => Promise<void>;
  handleDelete: (noteId: number) => Promise<void>;
  handleUndelete: (noteId: number) => Promise<void>;
  handlePermanentDelete: (noteId: number) => Promise<void>;
  reload: () => Promise<void>;
}

export function useNotes(entityType: string, entityId: number | null): UseNotesResult {
  const [notes, setNotes] = useState<models.Note[]>([]);
  const [loading, setLoading] = useState(false);

  const loadNotes = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const data = await GetNotes(entityType, entityId);
      setNotes(data || []);
    } catch (err) {
      LogErr('Failed to load notes:', err);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleAdd = useCallback(
    async (noteText: string) => {
      if (!entityId) return;
      const note = new models.Note();
      note.entityType = entityType;
      note.entityID = entityId;
      note.note = noteText;
      await CreateNote(note);
      await loadNotes();
    },
    [entityType, entityId, loadNotes]
  );

  const handleUpdate = useCallback(
    async (note: models.Note) => {
      await UpdateNote(note);
      await loadNotes();
    },
    [loadNotes]
  );

  const handleDelete = useCallback(
    async (noteId: number) => {
      await DeleteNote(noteId);
      await loadNotes();
    },
    [loadNotes]
  );

  const handleUndelete = useCallback(
    async (noteId: number) => {
      await UndeleteNote(noteId);
      await loadNotes();
    },
    [loadNotes]
  );

  const handlePermanentDelete = useCallback(
    async (noteId: number) => {
      await DeleteNotePermanent(noteId);
      await loadNotes();
    },
    [loadNotes]
  );

  return {
    notes,
    loading,
    handleAdd,
    handleUpdate,
    handleDelete,
    handleUndelete,
    handlePermanentDelete,
    reload: loadNotes,
  };
}
