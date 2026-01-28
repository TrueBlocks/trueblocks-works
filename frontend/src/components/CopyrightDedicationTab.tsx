import { useState, useEffect, useCallback } from 'react';
import { Grid, Textarea, Stack, Text, Loader, Flex, Paper, Button, Group } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  GetBookByCollection,
  UpdateBook,
  ExportBookPDF,
  ExportBookPDFWithParts,
  HasCollectionParts,
  OpenBookPDF,
} from '@app';
import { models } from '@models';
import { LogErr, Log } from '@/utils';
import { TwoPageSpread } from './TwoPageSpread';
import { PartSelectionModal } from './PartSelectionModal';
import classes from './PagePreview.module.css';
import { IconFileTypePdf, IconExternalLink } from '@tabler/icons-react';

interface CopyrightDedicationTabProps {
  collectionId: number;
}

const BODY_FONT = 'Garamond, Georgia, serif';
const COPYRIGHT_SIZE = 9;
const DEDICATION_SIZE = 12;

export function CopyrightDedicationTab({ collectionId }: CopyrightDedicationTabProps) {
  const [book, setBook] = useState<models.Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [partModalOpen, setPartModalOpen] = useState(false);

  const loadBook = useCallback(async () => {
    try {
      const result = await GetBookByCollection(collectionId);
      setBook(result);
    } catch (err) {
      LogErr('Failed to load book:', err);
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    loadBook();
  }, [loadBook]);

  const saveBook = useDebouncedCallback(async (updated: models.Book) => {
    try {
      await UpdateBook(updated);
    } catch (err) {
      LogErr('Failed to update book:', err);
      notifications.show({
        message: 'Failed to save changes',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, 500);

  const handleFieldChange = useCallback(
    (field: keyof models.Book, value: string) => {
      if (!book) return;
      const updated = { ...book, [field]: value };
      setBook(updated);
      saveBook(updated);
    },
    [book, saveBook]
  );

  const doExportPDF = useCallback(
    async (selectedParts: number[]) => {
      setExporting(true);
      try {
        const hasParts = selectedParts.length > 0 || (await HasCollectionParts(collectionId));
        const result = hasParts
          ? await ExportBookPDFWithParts(collectionId, selectedParts, false)
          : await ExportBookPDF(collectionId);

        if (result?.success) {
          Log(`PDF exported to: ${result.outputPath}`);
          notifications.show({
            title: 'PDF Export Complete',
            message: `Exported ${result.workCount} works in ${result.duration}`,
            color: 'green',
            autoClose: 8000,
          });
        } else {
          notifications.show({
            title: 'PDF Export Failed',
            message: result?.error || 'Unknown error',
            color: 'red',
            autoClose: 8000,
          });
        }
      } catch (err) {
        LogErr('PDF export failed:', err);
        notifications.show({
          title: 'PDF Export Failed',
          message: String(err),
          color: 'red',
          autoClose: 8000,
        });
      } finally {
        setExporting(false);
      }
    },
    [collectionId]
  );

  const handleExportPDF = useCallback(async () => {
    try {
      const hasParts = await HasCollectionParts(collectionId);
      if (hasParts) {
        setPartModalOpen(true);
      } else {
        await doExportPDF([]);
      }
    } catch (err) {
      LogErr('PDF export check failed:', err);
      await doExportPDF([]);
    }
  }, [collectionId, doExportPDF]);

  const handleOpenPDF = useCallback(async () => {
    try {
      const result = await OpenBookPDF(collectionId);
      if (!result.success) {
        notifications.show({
          title: 'Cannot Open PDF',
          message: result.error || 'PDF not found',
          color: 'yellow',
          autoClose: 5000,
        });
      }
    } catch (err) {
      LogErr('Open PDF failed:', err);
    }
  }, [collectionId]);

  if (loading) {
    return (
      <Flex justify="center" align="center" h={200}>
        <Loader />
      </Flex>
    );
  }

  if (!book) {
    return (
      <Flex justify="center" align="center" h={200}>
        <Text c="dimmed">No book settings found for this collection.</Text>
      </Flex>
    );
  }

  const copyrightContent = (
    <div className={classes.topThird}>
      <p
        className={classes.copyrightText}
        style={{ fontFamily: BODY_FONT, fontSize: COPYRIGHT_SIZE }}
      >
        {book.copyright || '© [Year] [Publisher]'}
      </p>
    </div>
  );

  const dedicationContent = (
    <div className={classes.topThird}>
      <p
        className={classes.dedicationText}
        style={{ fontFamily: BODY_FONT, fontSize: DEDICATION_SIZE }}
      >
        {book.dedication || ''}
      </p>
    </div>
  );

  return (
    <>
      <PartSelectionModal
        opened={partModalOpen}
        onClose={() => setPartModalOpen(false)}
        onConfirm={(indices) => {
          setPartModalOpen(false);
          doExportPDF(indices);
        }}
        collectionId={collectionId}
      />
      <Grid gutter="md">
        <Grid.Col span={4}>
          <Stack gap="sm">
            <Paper p="sm" withBorder>
              <Stack gap="sm">
                <Text fw={600} size="sm">
                  Copyright Page (verso)
                </Text>
                <Textarea
                  size="xs"
                  label="Copyright Text"
                  value={book.copyright || ''}
                  onChange={(e) => handleFieldChange('copyright', e.currentTarget.value)}
                  placeholder="© 2026 Publisher Name..."
                  minRows={3}
                  autosize
                  maxRows={6}
                />
                <Text fw={600} size="sm" mt="xs">
                  Dedication Page (recto)
                </Text>
                <Textarea
                  size="xs"
                  label="Dedication"
                  value={book.dedication || ''}
                  onChange={(e) => handleFieldChange('dedication', e.currentTarget.value)}
                  placeholder="For..."
                  minRows={2}
                  autosize
                  maxRows={4}
                />
              </Stack>
            </Paper>
            <Paper p="sm" withBorder>
              <Group gap="xs">
                <Button
                  size="xs"
                  leftSection={<IconFileTypePdf size={12} />}
                  onClick={handleExportPDF}
                  loading={exporting}
                >
                  Make Galley
                </Button>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconExternalLink size={12} />}
                  onClick={handleOpenPDF}
                >
                  Open
                </Button>
              </Group>
            </Paper>
          </Stack>
        </Grid.Col>
        <Grid.Col span={8}>
          <TwoPageSpread versoContent={copyrightContent} rectoContent={dedicationContent} />
        </Grid.Col>
      </Grid>
    </>
  );
}
