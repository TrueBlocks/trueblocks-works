import { useCallback } from 'react';
import { Grid, Textarea, Stack, Text, Paper } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { models } from '@models';
import { generateCopyrightHTML } from '@/utils/bookPageHTML';
import { PagePreview } from '@trueblocks/ui';

interface CopyrightPanelProps {
  book: models.Book;
  onBookChange: (book: models.Book) => void;
}

export function CopyrightPanel({ book, onBookChange }: CopyrightPanelProps) {
  const debouncedBookChange = useDebouncedCallback(onBookChange, 500);

  const handleFieldChange = useCallback(
    (value: string) => {
      const updated = { ...book, copyright: value };
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
                Copyright Page
              </Text>
              <Textarea
                size="xs"
                value={book.copyright || ''}
                onChange={(e) => handleFieldChange(e.currentTarget.value)}
                placeholder="© 2026 Publisher Name&#10;All rights reserved.&#10;&#10;ISBN: 000-0-0000-0000-0"
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
          html={generateCopyrightHTML({ book })}
          canvasWidthMM={152.4}
          canvasHeightMM={228.6}
        />
      </Grid.Col>
    </Grid>
  );
}
