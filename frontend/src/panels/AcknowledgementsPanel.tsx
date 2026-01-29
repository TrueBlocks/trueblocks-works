import { useCallback } from 'react';
import { Grid, Textarea, Stack, Text, Paper } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { models } from '@models';
import { generateAcknowledgementsHTML } from '@/utils/bookPageHTML';
import { PagePreview } from '@trueblocks/ui';

interface AcknowledgementsPanelProps {
  book: models.Book;
  onBookChange: (book: models.Book) => void;
}

export function AcknowledgementsPanel({ book, onBookChange }: AcknowledgementsPanelProps) {
  const debouncedBookChange = useDebouncedCallback(onBookChange, 500);

  const handleFieldChange = useCallback(
    (value: string) => {
      const updated = { ...book, acknowledgements: value };
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
                Acknowledgements
              </Text>
              <Textarea
                size="xs"
                value={book.acknowledgements || ''}
                onChange={(e) => handleFieldChange(e.currentTarget.value)}
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
          html={generateAcknowledgementsHTML({ book })}
          canvasWidthMM={152.4}
          canvasHeightMM={228.6}
        />
      </Grid.Col>
    </Grid>
  );
}
