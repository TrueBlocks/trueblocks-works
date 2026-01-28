import { useState, useEffect, useCallback } from 'react';
import {
  Grid,
  TextInput,
  Stack,
  Text,
  Loader,
  Flex,
  Paper,
  Button,
  Group,
  Badge,
} from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  GetBookByCollection,
  UpdateBook,
  SelectBookTemplate,
  ValidateTemplate,
  ExportBookPDF,
  ExportBookPDFWithParts,
  HasCollectionParts,
  AuditCollectionStyles,
  OpenBookPDF,
  AnalyzeCollectionHeadings,
} from '@app';
import { models, app } from '@models';
import { LogErr, Log } from '@/utils';
import { PagePreview } from './PagePreview';
import { PartSelectionModal } from './PartSelectionModal';
import classes from './PagePreview.module.css';
import {
  IconFileText,
  IconCheck,
  IconAlertCircle,
  IconFileTypePdf,
  IconExternalLink,
  IconChecks,
} from '@tabler/icons-react';

interface TitlePageTabProps {
  collectionId: number;
  collectionName: string;
}

const TITLE_FONT = 'Garamond, Georgia, serif';
const TITLE_SIZE = 24;
const SUBTITLE_SIZE = 14;
const AUTHOR_SIZE = 12;

export function TitlePageTab({ collectionId, collectionName }: TitlePageTabProps) {
  const [book, setBook] = useState<models.Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [templateValidation, setTemplateValidation] = useState<app.TemplateValidation | null>(null);
  const [validating, setValidating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [partModalOpen, setPartModalOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    audit?: app.CollectionAuditSummary;
    headings?: app.CollectionHeadingAnalysisResult;
  } | null>(null);

  const loadBook = useCallback(async () => {
    try {
      const result = await GetBookByCollection(collectionId);
      setBook(result);
      if (result?.templatePath) {
        const validation = await ValidateTemplate(result.templatePath);
        setTemplateValidation(validation);
      }
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

  const handleSelectTemplate = useCallback(async () => {
    try {
      const path = await SelectBookTemplate();
      if (!path || !book) return;

      setValidating(true);
      const validation = await ValidateTemplate(path);
      setTemplateValidation(validation);
      setValidating(false);

      if (!validation.isValid) {
        notifications.show({
          title: 'Invalid Template',
          message: validation.errors?.join(', ') || 'Template file is invalid',
          color: 'red',
          autoClose: 8000,
        });
        return;
      }

      const updated = { ...book, templatePath: path };
      setBook(updated);
      await UpdateBook(updated);
    } catch (err) {
      LogErr('Failed to select template:', err);
      setValidating(false);
    }
  }, [book]);

  const handleValidateAll = useCallback(async () => {
    setValidating(true);
    setValidationResult(null);
    try {
      const [audit, headings] = await Promise.all([
        AuditCollectionStyles(collectionId),
        AnalyzeCollectionHeadings(collectionId),
      ]);
      setValidationResult({ audit, headings });
      const allClean = audit.cleanWorks === audit.totalWorks && headings.failed === 0;
      notifications.show({
        title: allClean ? 'Validation Passed' : 'Validation Complete',
        message: allClean
          ? 'All works pass style and heading validation'
          : `${audit.dirtyWorks} style issues, ${headings.failed} heading issues`,
        color: allClean ? 'green' : 'yellow',
        autoClose: 5000,
      });
    } catch (err) {
      LogErr('Validation failed:', err);
      notifications.show({
        title: 'Validation Failed',
        message: String(err),
        color: 'red',
        autoClose: 5000,
      });
    } finally {
      setValidating(false);
    }
  }, [collectionId]);

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
        <Grid.Col span={6}>
          <Stack gap="sm">
            <Paper p="sm" withBorder>
              <Stack gap="xs">
                <Text fw={600} size="sm">
                  Title Page
                </Text>
                <TextInput
                  size="xs"
                  label="Title"
                  value={book.title || ''}
                  onChange={(e) => handleFieldChange('title', e.currentTarget.value)}
                  placeholder={collectionName}
                />
                <TextInput
                  size="xs"
                  label="Subtitle"
                  value={book.subtitle || ''}
                  onChange={(e) => handleFieldChange('subtitle', e.currentTarget.value)}
                  placeholder="Optional"
                />
                <TextInput
                  size="xs"
                  label="Author"
                  value={book.author || ''}
                  onChange={(e) => handleFieldChange('author', e.currentTarget.value)}
                />
              </Stack>
            </Paper>
            <Paper p="sm" withBorder>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text fw={600} size="sm">
                    Template & Validation
                  </Text>
                  {templateValidation && (
                    <Badge
                      size="xs"
                      color={templateValidation.isValid ? 'green' : 'yellow'}
                      leftSection={
                        templateValidation.isValid ? (
                          <IconCheck size={10} />
                        ) : (
                          <IconAlertCircle size={10} />
                        )
                      }
                    >
                      {templateValidation.isValid ? 'Valid' : 'Warning'}
                    </Badge>
                  )}
                </Group>
                <Group gap="xs">
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconFileText size={12} />}
                    onClick={handleSelectTemplate}
                    loading={validating}
                  >
                    {book.templatePath ? 'Change' : 'Template'}
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconChecks size={12} />}
                    onClick={handleValidateAll}
                    loading={validating}
                  >
                    Validate All
                  </Button>
                </Group>
                {book.templatePath && (
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {book.templatePath.split('/').pop()}
                  </Text>
                )}
                {validationResult && (
                  <Group gap="xs">
                    <Badge
                      size="xs"
                      color={
                        validationResult.audit?.cleanWorks === validationResult.audit?.totalWorks
                          ? 'green'
                          : 'yellow'
                      }
                    >
                      Styles: {validationResult.audit?.cleanWorks}/
                      {validationResult.audit?.totalWorks}
                    </Badge>
                    <Badge
                      size="xs"
                      color={validationResult.headings?.failed === 0 ? 'green' : 'yellow'}
                    >
                      Headings: {validationResult.headings?.successful}/
                      {validationResult.headings?.totalWorks}
                    </Badge>
                  </Group>
                )}
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
        <Grid.Col span={6}>
          <PagePreview>
            <div className={classes.topThird}>
              <p
                className={classes.titleText}
                style={{ fontFamily: TITLE_FONT, fontSize: TITLE_SIZE }}
              >
                {book.title || collectionName}
              </p>
              {book.subtitle && (
                <>
                  <div style={{ height: 8 }} />
                  <p
                    className={classes.subtitleText}
                    style={{ fontFamily: TITLE_FONT, fontSize: SUBTITLE_SIZE }}
                  >
                    {book.subtitle}
                  </p>
                </>
              )}
              <div style={{ height: 32 }} />
              <p
                className={classes.authorText}
                style={{ fontFamily: TITLE_FONT, fontSize: AUTHOR_SIZE }}
              >
                {book.author}
              </p>
            </div>
          </PagePreview>
        </Grid.Col>
      </Grid>
    </>
  );
}
