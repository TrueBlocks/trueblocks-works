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
  GetTitlePageStyles,
  GetCollection,
} from '@app';
import { models } from '@models';
import { LogErr, Log } from '@/utils';
import { generateTitlePageHTML } from '@/utils/titlePageHTML';
import { TwoPageSpread } from './TwoPageSpread';
import { PartSelectionModal } from './PartSelectionModal';
import classes from './PagePreview.module.css';
import { IconFileTypePdf, IconExternalLink } from '@tabler/icons-react';

interface AckAboutTabProps {
  collectionId: number;
}

const BODY_FONT = 'Garamond, Georgia, serif';
const HEADING_SIZE = 16;
const BODY_SIZE = 8;

export function AckAboutTab({ collectionId }: AckAboutTabProps) {
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
      if (!book) return;
      setExporting(true);
      try {
        const [coll, styles] = await Promise.all([
          GetCollection(collectionId),
          book.templatePath ? GetTitlePageStyles(book.templatePath) : Promise.resolve(null),
        ]);
        const titlePageHTML = generateTitlePageHTML({
          book,
          collectionName: coll?.collectionName || '',
          templateStyles: styles,
        });

        const hasParts = selectedParts.length > 0 || (await HasCollectionParts(collectionId));
        const result = hasParts
          ? await ExportBookPDFWithParts(collectionId, selectedParts, false, titlePageHTML)
          : await ExportBookPDF(collectionId, titlePageHTML);

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
    [book, collectionId]
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

  const acknowledgmentsContent = (
    <div>
      <p className={classes.sectionTitle} style={{ fontFamily: BODY_FONT, fontSize: HEADING_SIZE }}>
        Acknowledgements
      </p>
      <p className={classes.bodyText} style={{ fontFamily: BODY_FONT, fontSize: BODY_SIZE }}>
        {book.acknowledgements || ''}
      </p>
    </div>
  );

  const aboutContent = (
    <div>
      <p className={classes.sectionTitle} style={{ fontFamily: BODY_FONT, fontSize: HEADING_SIZE }}>
        About the Author
      </p>
      <p className={classes.bodyText} style={{ fontFamily: BODY_FONT, fontSize: BODY_SIZE }}>
        {book.aboutAuthor || ''}
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
                  Acknowledgements (verso)
                </Text>
                <Textarea
                  size="xs"
                  value={book.acknowledgements || ''}
                  onChange={(e) => handleFieldChange('acknowledgements', e.currentTarget.value)}
                  placeholder="I would like to thank..."
                  minRows={4}
                  autosize
                  maxRows={8}
                />
                <Text fw={600} size="sm" mt="xs">
                  About the Author (recto)
                </Text>
                <Textarea
                  size="xs"
                  value={book.aboutAuthor || ''}
                  onChange={(e) => handleFieldChange('aboutAuthor', e.currentTarget.value)}
                  placeholder="Thomas Jay Rush is..."
                  minRows={4}
                  autosize
                  maxRows={8}
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
          <TwoPageSpread versoContent={acknowledgmentsContent} rectoContent={aboutContent} />
        </Grid.Col>
      </Grid>
    </>
  );
}
