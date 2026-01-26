import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stack,
  Paper,
  TextInput,
  Textarea,
  Select,
  Grid,
  Text,
  Loader,
  Anchor,
  Flex,
  Button,
  Group,
  Badge,
} from '@mantine/core';
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
  OpenTemplate,
  OpenBookPDF,
  AnalyzeCollectionHeadings,
} from '@app';
import { models, app } from '@models';
import { LogErr, Log } from '@/utils';
import {
  IconFileText,
  IconCheck,
  IconAlertCircle,
  IconReportAnalytics,
  IconFileTypePdf,
  IconEdit,
  IconExternalLink,
} from '@tabler/icons-react';
import { PartSelectionModal } from './PartSelectionModal';

interface BookSettingsTabProps {
  collectionId: number;
  collectionName: string;
}

export function BookSettingsTab({ collectionId, collectionName }: BookSettingsTabProps) {
  const navigate = useNavigate();
  const [book, setBook] = useState<models.Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [templateValidation, setTemplateValidation] = useState<app.TemplateValidation | null>(null);
  const [validating, setValidating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<app.BookExportResult | null>(null);
  const [auditSummary, setAuditSummary] = useState<app.CollectionAuditSummary | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [partModalOpen, setPartModalOpen] = useState(false);
  const [analyzingHeadings, setAnalyzingHeadings] = useState(false);
  const [headingAnalysisResult, setHeadingAnalysisResult] =
    useState<app.CollectionHeadingAnalysisResult | null>(null);

  const loadBook = useCallback(async () => {
    try {
      const result = await GetBookByCollection(collectionId);
      setBook(result);
      // Validate template if one is set
      if (result?.templatePath) {
        setValidating(true);
        const validation = await ValidateTemplate(result.templatePath);
        setTemplateValidation(validation);
        setValidating(false);
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

  const handleFieldChange = useCallback(
    async (field: keyof models.Book, value: string) => {
      if (!book) return;
      const updated = { ...book, [field]: value };
      setBook(updated);
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
    },
    [book]
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
          title: 'Template Warning',
          message: `Template may be missing required styles: ${validation.requiredMissing?.join(', ')}`,
          color: 'yellow',
          autoClose: 8000,
        });
      }

      handleFieldChange('templatePath', path);
    } catch (err) {
      LogErr('Failed to select template:', err);
      setValidating(false);
    }
  }, [book, handleFieldChange]);

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
      notifications.show({
        title: 'Open PDF Failed',
        message: String(err),
        color: 'red',
        autoClose: 5000,
      });
    }
  }, [collectionId]);

  const doExportPDF = useCallback(
    async (selectedParts: number[]) => {
      setExporting(true);
      setLastExport(null);
      try {
        const hasParts = selectedParts.length > 0 || (await HasCollectionParts(collectionId));
        let result: app.BookExportResult | null = null;

        if (hasParts) {
          result = await ExportBookPDFWithParts(collectionId, selectedParts, false);
        } else {
          result = await ExportBookPDF(collectionId);
        }

        if (!result) return;
        setLastExport(result);
        if (result.success) {
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
            message: result.error || 'Unknown error',
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

  const handlePartModalConfirm = useCallback(
    (selectedIndices: number[]) => {
      setPartModalOpen(false);
      doExportPDF(selectedIndices);
    },
    [doExportPDF]
  );

  const handleRunAudit = useCallback(async () => {
    setAuditing(true);
    try {
      const result = await AuditCollectionStyles(collectionId);
      setAuditSummary(result);
    } catch (err) {
      LogErr('Audit failed:', err);
      notifications.show({
        title: 'Audit Failed',
        message: String(err),
        color: 'red',
        autoClose: 5000,
      });
    } finally {
      setAuditing(false);
    }
  }, [collectionId]);

  const handleAnalyzeHeadings = useCallback(async () => {
    setAnalyzingHeadings(true);
    setHeadingAnalysisResult(null);
    try {
      const result = await AnalyzeCollectionHeadings(collectionId);
      setHeadingAnalysisResult(result);
      if (result.failed === 0) {
        notifications.show({
          title: 'Heading Analysis Complete',
          message: `Successfully analyzed ${result.successful} works`,
          color: 'green',
          autoClose: 5000,
        });
      }
    } catch (err) {
      LogErr('Heading analysis failed:', err);
      notifications.show({
        title: 'Heading Analysis Failed',
        message: String(err),
        color: 'red',
        autoClose: 5000,
      });
    } finally {
      setAnalyzingHeadings(false);
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
        onConfirm={handlePartModalConfirm}
        collectionId={collectionId}
      />
      <Stack gap="sm">
        <Paper p="sm" withBorder>
          <Text fw={600} size="xs" c="dimmed" mb="xs">
            METADATA
          </Text>
          <Grid gutter="xs">
            <Grid.Col span={6}>
              <TextInput
                size="sm"
                label="Title"
                value={book.title || ''}
                onChange={(e) => handleFieldChange('title', e.currentTarget.value)}
                placeholder={collectionName}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                size="sm"
                label="Subtitle"
                value={book.subtitle || ''}
                onChange={(e) => handleFieldChange('subtitle', e.currentTarget.value)}
                placeholder="Optional"
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput
                size="sm"
                label="Author"
                value={book.author || ''}
                onChange={(e) => handleFieldChange('author', e.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput
                size="sm"
                label="ISBN"
                value={book.isbn || ''}
                onChange={(e) => handleFieldChange('isbn', e.currentTarget.value)}
                placeholder="978-..."
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <Select
                size="sm"
                label="Status"
                value={book.status || 'draft'}
                onChange={(value) => handleFieldChange('status', value || 'draft')}
                data={[
                  { value: 'draft', label: 'Draft' },
                  { value: 'ready', label: 'Ready' },
                  { value: 'published', label: 'Published' },
                ]}
              />
            </Grid.Col>
          </Grid>
        </Paper>

        <Paper p="sm" withBorder>
          <Text fw={600} size="xs" c="dimmed" mb="xs">
            FRONT MATTER
          </Text>
          <Grid gutter="xs">
            <Grid.Col span={6}>
              <Textarea
                size="sm"
                label="Copyright"
                value={book.copyright || ''}
                onChange={(e) => handleFieldChange('copyright', e.currentTarget.value)}
                placeholder="© 2026 Thomas Jay Rush..."
                minRows={2}
                autosize
                maxRows={4}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Textarea
                size="sm"
                label="Dedication"
                value={book.dedication || ''}
                onChange={(e) => handleFieldChange('dedication', e.currentTarget.value)}
                placeholder="For..."
                minRows={2}
                autosize
                maxRows={4}
              />
            </Grid.Col>
          </Grid>
        </Paper>

        <Paper p="sm" withBorder>
          <Text fw={600} size="xs" c="dimmed" mb="xs">
            BACK MATTER
          </Text>
          <Grid gutter="xs">
            <Grid.Col span={6}>
              <Textarea
                size="sm"
                label="Acknowledgements"
                value={book.acknowledgements || ''}
                onChange={(e) => handleFieldChange('acknowledgements', e.currentTarget.value)}
                placeholder="I would like to thank..."
                minRows={2}
                autosize
                maxRows={4}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Textarea
                size="sm"
                label="About the Author"
                value={book.aboutAuthor || ''}
                onChange={(e) => handleFieldChange('aboutAuthor', e.currentTarget.value)}
                placeholder="Thomas Jay Rush is..."
                minRows={2}
                autosize
                maxRows={4}
              />
            </Grid.Col>
          </Grid>
        </Paper>

        <Paper p="sm" withBorder>
          <Text fw={600} size="xs" c="dimmed" mb="xs">
            TEMPLATE & EXPORT
          </Text>
          <Grid gutter="xs">
            <Grid.Col span={6}>
              <Text size="xs" fw={500} mb={4}>
                Template
              </Text>
              <Group gap="xs">
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconFileText size={14} />}
                  onClick={handleSelectTemplate}
                  loading={validating}
                >
                  {book.templatePath ? 'Change' : 'Select Template'}
                </Button>
                {book.templatePath && (
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconEdit size={14} />}
                    onClick={async () => {
                      if (book.templatePath) {
                        try {
                          await OpenTemplate(book.templatePath);
                        } catch (err) {
                          LogErr('Failed to open template:', err);
                        }
                      }
                    }}
                  >
                    Edit
                  </Button>
                )}
                {templateValidation && (
                  <Badge
                    size="sm"
                    color={templateValidation.isValid ? 'green' : 'yellow'}
                    leftSection={
                      templateValidation.isValid ? (
                        <IconCheck size={12} />
                      ) : (
                        <IconAlertCircle size={12} />
                      )
                    }
                  >
                    {templateValidation.isValid ? 'Valid' : 'Warning'}
                  </Badge>
                )}
              </Group>
              {book.templatePath && (
                <Text size="xs" c="dimmed" mt={4} lineClamp={1}>
                  {book.templatePath.split('/').pop()}
                </Text>
              )}
            </Grid.Col>
            <Grid.Col span={6}>
              <Stack gap="xs">
                <Group gap="xs">
                  <Button
                    size="sm"
                    leftSection={<IconFileTypePdf size={16} />}
                    onClick={handleExportPDF}
                    loading={exporting}
                  >
                    Make Galley
                  </Button>
                  <Button
                    size="sm"
                    variant="light"
                    leftSection={<IconExternalLink size={16} />}
                    onClick={handleOpenPDF}
                  >
                    Open Galley
                  </Button>
                </Group>
                {lastExport?.success && (
                  <Text size="xs" c="green">
                    ✓ Exported {lastExport.workCount} works ({lastExport.duration})
                  </Text>
                )}
                {lastExport && !lastExport.success && (
                  <Text size="xs" c="red">
                    ✗ {lastExport.error}
                  </Text>
                )}
              </Stack>
            </Grid.Col>
          </Grid>
        </Paper>

        {/* STYLE AUDIT */}
        <Paper p="md" withBorder>
          <Group justify="space-between" mb="sm">
            <Group gap="xs">
              <IconReportAnalytics size={20} />
              <Text fw={600}>Style Audit</Text>
            </Group>
            <Group gap="xs">
              <Button
                size="xs"
                variant="light"
                leftSection={<IconReportAnalytics size={14} />}
                onClick={handleRunAudit}
                loading={auditing}
              >
                Run Audit
              </Button>
            </Group>
          </Group>
          <Text size="sm" c="dimmed" mb="md">
            Check which essays use only template styles vs. direct formatting.
          </Text>
          {auditSummary && (
            <Stack gap="xs">
              <Group gap="md">
                <Badge
                  size="lg"
                  color={auditSummary.cleanWorks === auditSummary.totalWorks ? 'green' : 'yellow'}
                >
                  {auditSummary.cleanWorks}/{auditSummary.totalWorks} clean
                </Badge>
                {auditSummary.dirtyWorks > 0 && (
                  <Badge size="lg" color="orange">
                    {auditSummary.dirtyWorks} need cleanup
                  </Badge>
                )}
                {auditSummary.missingFiles > 0 && (
                  <Badge size="lg" color="red">
                    {auditSummary.missingFiles} missing files
                  </Badge>
                )}
              </Group>
              {auditSummary.dirtyWorks > 0 && (
                <Stack gap={4} mt="xs">
                  <Text size="xs" fw={500}>
                    Works needing cleanup:
                  </Text>
                  {auditSummary.results
                    .filter((r) => !r.isClean)
                    .slice(0, 10)
                    .map((r) => (
                      <Text key={r.workID} size="xs" c="dimmed">
                        •{' '}
                        <Anchor
                          size="xs"
                          onClick={() =>
                            navigate(`/works/${r.workID}`, {
                              state: { fromCollection: collectionId },
                            })
                          }
                        >
                          {r.title}
                        </Anchor>
                        {r.unknownStyles.length > 0 &&
                          ` (${r.unknownStyles.length} unknown styles)`}
                        {r.directFormattingCount > 0 && ` (${r.directFormattingCount} direct)`}
                      </Text>
                    ))}
                  {auditSummary.dirtyWorks > 10 && (
                    <Text size="xs" c="dimmed" fs="italic">
                      ...and {auditSummary.dirtyWorks - 10} more
                    </Text>
                  )}
                </Stack>
              )}
            </Stack>
          )}
        </Paper>

        {/* HEADING ANALYSIS */}
        <Paper p="md" withBorder>
          <Group justify="space-between" mb="sm">
            <Group gap="xs">
              <IconReportAnalytics size={20} />
              <Text fw={600}>Heading Analysis</Text>
            </Group>
            <Group gap="xs">
              <Button
                size="xs"
                variant="light"
                leftSection={<IconReportAnalytics size={14} />}
                onClick={handleAnalyzeHeadings}
                loading={analyzingHeadings}
              >
                Analyze Headings
              </Button>
            </Group>
          </Group>
          <Text size="sm" c="dimmed" mb="md">
            Extract heading structure from essays and validate styles against template.
          </Text>
          {headingAnalysisResult && (
            <Stack gap="xs">
              <Group gap="md">
                <Badge size="lg" color={headingAnalysisResult.failed === 0 ? 'green' : 'yellow'}>
                  {headingAnalysisResult.successful}/{headingAnalysisResult.totalWorks} works
                  analyzed
                </Badge>
                {headingAnalysisResult.failed > 0 && (
                  <Badge size="lg" color="red">
                    {headingAnalysisResult.failed} failed
                  </Badge>
                )}
              </Group>
              {headingAnalysisResult.successful > 0 && (
                <Text size="sm" c="dimmed">
                  Found {headingAnalysisResult.totalHeadings} headings in{' '}
                  {headingAnalysisResult.worksWithHeadings} works
                  {headingAnalysisResult.worksWithDateline > 0 &&
                    ` • ${headingAnalysisResult.worksWithDateline} works have datelines`}
                </Text>
              )}
              {headingAnalysisResult.firstError && (
                <Stack gap={4} mt="xs">
                  <Text size="xs" fw={500} c="red">
                    Stopped at: {headingAnalysisResult.firstError.title}
                  </Text>
                  {headingAnalysisResult.firstError.unknownStyles &&
                    headingAnalysisResult.firstError.unknownStyles.length > 0 && (
                      <Text size="xs" c="dimmed">
                        Unknown styles: {headingAnalysisResult.firstError.unknownStyles.join(', ')}
                      </Text>
                    )}
                  {headingAnalysisResult.firstError.error && (
                    <Text size="xs" c="dimmed">
                      Error: {headingAnalysisResult.firstError.error}
                    </Text>
                  )}
                  <Anchor
                    size="xs"
                    onClick={() =>
                      navigate(`/works/${headingAnalysisResult.firstError?.workId}`, {
                        state: { fromCollection: collectionId },
                      })
                    }
                  >
                    Open work →
                  </Anchor>
                </Stack>
              )}
            </Stack>
          )}
        </Paper>
      </Stack>
    </>
  );
}
