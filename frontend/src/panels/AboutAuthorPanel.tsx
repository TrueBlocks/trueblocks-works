import { useCallback } from 'react';
import { Grid, Textarea, Stack, Text, Paper } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { models } from '@models';
import { generateAboutAuthorHTML } from '@/utils/bookPageHTML';
import { PagePreview } from '@trueblocks/ui';

interface AboutAuthorPanelProps {
  book: models.Book;
  onBookChange: (book: models.Book) => void;
}

export function AboutAuthorPanel({ book, onBookChange }: AboutAuthorPanelProps) {
  const debouncedBookChange = useDebouncedCallback(onBookChange, 500);

  const handleFieldChange = useCallback(
    (value: string) => {
      const updated = { ...book, aboutAuthor: value };
      debouncedBookChange(updated);
    },
    [book, debouncedBookChange]
  );

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
                value={book.aboutAuthor || ''}
                onChange={(e) => handleFieldChange(e.currentTarget.value)}
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
        <PagePreview html={generateAboutAuthorHTML({ book })} />
      </Grid.Col>
    </Grid>
  );
}
