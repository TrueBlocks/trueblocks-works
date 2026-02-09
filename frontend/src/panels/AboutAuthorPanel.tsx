import { useState } from 'react';
import { Grid, Textarea, Stack, Text, Paper } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { models, app } from '@models';
import { generateAboutAuthorHTML } from '@/utils/bookPageHTML';
import { PagePreview } from '@trueblocks/ui';

interface AboutAuthorPanelProps {
  book: models.Book;
  onBookChange: (book: models.Book) => void;
  templateStyles: app.TitlePageStyleInfo | null;
}

export function AboutAuthorPanel({ book, onBookChange, templateStyles }: AboutAuthorPanelProps) {
  const [localValue, setLocalValue] = useState(book.aboutAuthor || '');
  const [trackedBookId, setTrackedBookId] = useState(book.bookID);

  if (book.bookID !== trackedBookId) {
    setTrackedBookId(book.bookID);
    setLocalValue(book.aboutAuthor || '');
  }

  const debouncedSave = useDebouncedCallback((value: string, currentBook: models.Book) => {
    onBookChange({ ...currentBook, aboutAuthor: value });
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
                About the Author
              </Text>
              <Textarea
                size="xs"
                value={localValue}
                onChange={(e) => handleChange(e.currentTarget.value)}
                placeholder="Thomas Jay Rush is..."
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
          html={generateAboutAuthorHTML({ book, templateStyles })}
          canvasWidthMM={152.4}
          canvasHeightMM={228.6}
        />
      </Grid.Col>
    </Grid>
  );
}
