import { useState } from 'react';
import { Grid, Textarea, Stack, Text, Paper } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { models, app } from '@models';
import { generateAcknowledgementsHTML } from '@/utils/bookPageHTML';
import { PagePreview } from '@trueblocks/ui';

interface AcknowledgementsPanelProps {
  book: models.Book;
  onBookChange: (book: models.Book) => void;
  templateStyles: app.TitlePageStyleInfo | null;
}

export function AcknowledgementsPanel({
  book,
  onBookChange,
  templateStyles,
}: AcknowledgementsPanelProps) {
  const [localValue, setLocalValue] = useState(book.acknowledgements || '');
  const [trackedBookId, setTrackedBookId] = useState(book.bookID);

  if (book.bookID !== trackedBookId) {
    setTrackedBookId(book.bookID);
    setLocalValue(book.acknowledgements || '');
  }

  const debouncedSave = useDebouncedCallback((value: string, currentBook: models.Book) => {
    onBookChange({ ...currentBook, acknowledgements: value });
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
                Acknowledgements
              </Text>
              <Textarea
                size="xs"
                value={localValue}
                onChange={(e) => handleChange(e.currentTarget.value)}
                placeholder="I would like to thank..."
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
          html={generateAcknowledgementsHTML({ book, templateStyles })}
          canvasWidthMM={152.4}
          canvasHeightMM={228.6}
        />
      </Grid.Col>
    </Grid>
  );
}
