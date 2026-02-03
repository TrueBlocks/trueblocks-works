import { useState } from 'react';
import { Grid, Textarea, Stack, Text, Paper } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { models } from '@models';
import { generateDedicationHTML } from '@/utils/bookPageHTML';
import { PagePreview } from '@trueblocks/ui';

interface DedicationPanelProps {
  book: models.Book;
  onBookChange: (book: models.Book) => void;
}

export function DedicationPanel({ book, onBookChange }: DedicationPanelProps) {
  const [localValue, setLocalValue] = useState(book.dedication || '');
  const [trackedBookId, setTrackedBookId] = useState(book.bookID);

  if (book.bookID !== trackedBookId) {
    setTrackedBookId(book.bookID);
    setLocalValue(book.dedication || '');
  }

  const debouncedSave = useDebouncedCallback((value: string, currentBook: models.Book) => {
    onBookChange({ ...currentBook, dedication: value });
  }, 500);

  const handleChange = (value: string) => {
    setLocalValue(value);
    debouncedSave(value, book);
  };

  return (
    <Grid gutter="md">
      <Grid.Col span={6}>
        <Stack gap="sm">
          <Paper p="sm" withBorder>
            <Stack gap="xs">
              <Text fw={600} size="sm">
                Dedication Page
              </Text>
              <Textarea
                size="xs"
                value={localValue}
                onChange={(e) => handleChange(e.currentTarget.value)}
                placeholder="For..."
                minRows={4}
                autosize
                maxRows={10}
              />
            </Stack>
          </Paper>
        </Stack>
      </Grid.Col>
      <Grid.Col span={6}>
        <PagePreview
          html={generateDedicationHTML({ book })}
          canvasWidthMM={152.4}
          canvasHeightMM={228.6}
        />
      </Grid.Col>
    </Grid>
  );
}
