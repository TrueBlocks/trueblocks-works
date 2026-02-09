import { useState } from 'react';
import { Grid, Textarea, Stack, Text, Paper } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { models } from '@models';
import { generateAfterwordHTML } from '@/utils/bookPageHTML';
import { PagePreview } from '@trueblocks/ui';

interface AfterwordPanelProps {
  book: models.Book;
  onBookChange: (book: models.Book) => void;
}

export function AfterwordPanel({ book, onBookChange }: AfterwordPanelProps) {
  const [localValue, setLocalValue] = useState(book.afterword || '');
  const [trackedBookId, setTrackedBookId] = useState(book.bookID);

  if (book.bookID !== trackedBookId) {
    setTrackedBookId(book.bookID);
    setLocalValue(book.afterword || '');
  }

  const debouncedSave = useDebouncedCallback((value: string, currentBook: models.Book) => {
    onBookChange({ ...currentBook, afterword: value });
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
                Afterword
              </Text>
              <Textarea
                size="xs"
                value={localValue}
                onChange={(e) => handleChange(e.currentTarget.value)}
                placeholder="In writing this book..."
                minRows={8}
                autosize
                maxRows={16}
              />
            </Stack>
          </Paper>
        </Stack>
      </Grid.Col>
      <Grid.Col span={6}>
        <PagePreview
          html={generateAfterwordHTML({ book })}
          canvasWidthMM={152.4}
          canvasHeightMM={228.6}
        />
      </Grid.Col>
    </Grid>
  );
}
