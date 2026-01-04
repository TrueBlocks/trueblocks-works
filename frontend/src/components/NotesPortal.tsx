import { useState } from 'react';
import {
  Paper,
  Title,
  Text,
  Stack,
  Group,
  ActionIcon,
  Textarea,
  Button,
  Card,
} from '@mantine/core';
import { IconPlus, IconTrash, IconEdit } from '@tabler/icons-react';
import { models } from '@wailsjs/go/models';
import dayjs from 'dayjs';

interface NotesPortalProps {
  notes: models.WorkNote[];
  onAdd: (note: string) => void;
  onUpdate: (note: models.WorkNote) => void;
  onDelete: (id: number) => void;
}

function getNoteId(note: models.WorkNote): number {
  return note.id;
}

function getNoteText(note: models.WorkNote): string {
  return note.note || '';
}

export function NotesPortal({ notes, onAdd, onUpdate, onDelete }: NotesPortalProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  const handleAdd = () => {
    if (newNote.trim()) {
      onAdd(newNote.trim());
      setNewNote('');
      setIsAdding(false);
    }
  };

  const handleStartEdit = (note: models.WorkNote) => {
    setEditingId(getNoteId(note));
    setEditText(getNoteText(note));
  };

  const handleSaveEdit = (note: models.WorkNote) => {
    if (editText.trim()) {
      onUpdate({ ...note, note: editText.trim() });
    }
    setEditingId(null);
    setEditText('');
  };

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="md">
        <Title order={4}>Notes</Title>
        <ActionIcon variant="light" onClick={() => setIsAdding(true)}>
          <IconPlus size={16} />
        </ActionIcon>
      </Group>

      <Stack gap="sm">
        {isAdding && (
          <Card withBorder>
            <Textarea
              placeholder="Add a note..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              autoFocus
              minRows={2}
            />
            <Group justify="flex-end" mt="sm">
              <Button variant="subtle" size="xs" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
              <Button size="xs" onClick={handleAdd}>
                Add Note
              </Button>
            </Group>
          </Card>
        )}

        {notes.length === 0 && !isAdding && (
          <Text c="dimmed" size="sm" ta="center">
            No notes yet
          </Text>
        )}

        {notes.map((note) => (
          <Card key={getNoteId(note)} withBorder padding="sm">
            {editingId === getNoteId(note) ? (
              <>
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  autoFocus
                  minRows={2}
                />
                <Group justify="flex-end" mt="sm">
                  <Button variant="subtle" size="xs" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                  <Button size="xs" onClick={() => handleSaveEdit(note)}>
                    Save
                  </Button>
                </Group>
              </>
            ) : (
              <>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {getNoteText(note)}
                </Text>
                <Group justify="space-between" mt="xs">
                  <Text size="xs" c="dimmed">
                    {dayjs(note.createdAt).format('MMM D, YYYY')}
                  </Text>
                  <Group gap="xs">
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      color="red"
                      onClick={() => onDelete(getNoteId(note))}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" size="sm" onClick={() => handleStartEdit(note)}>
                      <IconEdit size={14} />
                    </ActionIcon>
                  </Group>
                </Group>
              </>
            )}
          </Card>
        ))}
      </Stack>
    </Paper>
  );
}
