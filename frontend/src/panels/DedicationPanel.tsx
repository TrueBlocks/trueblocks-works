import { useCallback } from 'react';
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
  const debouncedBookChange = useDebouncedCallback(onBookChange, 500);

  const handleFieldChange = useCallback(
    (value: string) => {
      const updated = { ...book, dedication: value };
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
                Dedication Page
              </Text>
              <Textarea
                size="xs"
                value={book.dedication || ''}
                onChange={(e) => handleFieldChange(e.currentTarget.value)}
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
