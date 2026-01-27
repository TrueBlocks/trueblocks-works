import { useState, useEffect } from 'react';
import { GetDistinctValues, UpdateNote } from '@app';
import { models } from '@models';
import { LogErr, hashColor, showValidationResult } from '@/utils';
import { CreatableSelect } from '@trueblocks/ui';

interface NoteFieldSelectProps {
  note: models.Note;
  colorMap?: Record<string, string>;
  width?: number;
  onUpdate?: (note: models.Note) => void;
}

export function NoteFieldSelect({ note, colorMap, width = 100, onUpdate }: NoteFieldSelectProps) {
  const [options, setOptions] = useState<string[]>([]);
  const [value, setValue] = useState<string | null>(note.type || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    GetDistinctValues('Notes', 'type')
      .then((values) => setOptions(values || []))
      .catch((err) => LogErr('Failed to load note type options:', err));
  }, []);

  useEffect(() => {
    setValue(note.type || null);
  }, [note.type]);

  const handleChange = async (newValue: string) => {
    if (!newValue || newValue === note.type) return;

    setLoading(true);
    setValue(newValue);
    try {
      const updated = { ...note, type: newValue };
      const result = await UpdateNote(updated as models.Note);
      if (!showValidationResult(result)) {
        onUpdate?.(updated as models.Note);
      } else {
        setValue(note.type || null);
      }
    } catch (err) {
      LogErr('Failed to update note type:', err);
      setValue(note.type || null);
    } finally {
      setLoading(false);
    }
  };

  const color = colorMap?.[value as string] ?? hashColor(value);

  return (
    <CreatableSelect
      data={options}
      value={value}
      onChange={handleChange}
      disabled={loading}
      size="xs"
      w={width}
      styles={{
        input: {
          backgroundColor: `var(--mantine-color-${color}-1)`,
          color: `var(--mantine-color-${color}-9)`,
          fontWeight: 500,
          border: `1px solid var(--mantine-color-${color}-3)`,
        },
      }}
    />
  );
}
