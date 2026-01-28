import { useState, useEffect, useCallback } from 'react';
import { Tabs, Box, Button, Group, Paper, Loader, Flex, Text, Badge, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconTypography,
  IconCopyright,
  IconHeart,
  IconFileTypePdf,
  IconExternalLink,
  IconChecks,
} from '@tabler/icons-react';
import {
  GetBookByCollection,
  UpdateBook,
  ExportBookPDF,
  ExportBookPDFWithParts,
  HasCollectionParts,
  AuditCollectionStyles,
  OpenBookPDF,
  AnalyzeCollectionHeadings,
  GetTitlePageStyles,
  ValidateTemplate,
} from '@app';
import { models, app } from '@models';
import { LogErr, Log, generateTitlePageHTML } from '@/utils';
import {
  generateCopyrightHTML,
  generateDedicationHTML,
  generateAcknowledgementsHTML,
  generateAboutAuthorHTML,
} from '@/utils/bookPageHTML';
import { PartSelectionModal } from '@/modals';
import { TitlePagePanel, CopyrightPanel, DedicationPanel } from '@/panels';

interface FrontMatterViewProps {
  collectionId: number;
  collectionName: string;
  activeSubTab: string;
  onSubTabChange: (value: string | null) => void;
}

export function FrontMatterView({
  collectionId,
  collectionName,
  activeSubTab,
  onSubTabChange,
}: FrontMatterViewProps) {
  const [book, setBook] = useState<models.Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [templateStyles, setTemplateStyles] = useState<app.TitlePageStyleInfo | null>(null);
  const [exporting, setExporting] = useState(false);
  const [validating, setValidating] = useState(false);
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
        const [, styles] = await Promise.all([
          ValidateTemplate(result.templatePath),
          GetTitlePageStyles(result.templatePath),
        ]);
        setTemplateStyles(styles);
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

  const handleBookChange = useCallback(async (updated: models.Book) => {
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
  }, []);

  const handleTemplateStylesChange = useCallback((styles: app.TitlePageStyleInfo | null) => {
    setTemplateStyles(styles);
  }, []);

  const buildHtmlContent = useCallback(() => {
    if (!book) return null;
    return {
      titlePage: generateTitlePageHTML({ book, collectionName, templateStyles }),
      copyright: book.copyright ? generateCopyrightHTML({ book }) : '',
      dedication: book.dedication ? generateDedicationHTML({ book }) : '',
      acknowledgements: book.acknowledgements ? generateAcknowledgementsHTML({ book }) : '',
      aboutAuthor: book.aboutAuthor ? generateAboutAuthorHTML({ book }) : '',
    };
  }, [book, collectionName, templateStyles]);

  const doExportPDF = useCallback(
    async (selectedParts: number[]) => {
      const htmlContent = buildHtmlContent();
      if (!htmlContent) return;

      setExporting(true);
      try {
        const hasParts = selectedParts.length > 0 || (await HasCollectionParts(collectionId));
        const result = hasParts
          ? await ExportBookPDFWithParts(collectionId, selectedParts, false, htmlContent)
          : await ExportBookPDF(collectionId, htmlContent);

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
    [buildHtmlContent, collectionId]
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
    <Box>
      <PartSelectionModal
        opened={partModalOpen}
        onClose={() => setPartModalOpen(false)}
        onConfirm={(indices) => {
          setPartModalOpen(false);
          doExportPDF(indices);
        }}
        collectionId={collectionId}
      />

      <Paper p="xs" mb="md" withBorder>
        <Group justify="space-between">
          <Group gap="xs">
            <Tooltip label="Validate styles and headings">
              <Button
                size="xs"
                variant="light"
                leftSection={<IconChecks size={12} />}
                onClick={handleValidateAll}
                loading={validating}
              >
                Validate
              </Button>
            </Tooltip>
            {validationResult && (
              <>
                <Badge
                  size="xs"
                  color={
                    validationResult.audit?.cleanWorks === validationResult.audit?.totalWorks
                      ? 'green'
                      : 'yellow'
                  }
                >
                  Styles: {validationResult.audit?.cleanWorks}/{validationResult.audit?.totalWorks}
                </Badge>
                <Badge
                  size="xs"
                  color={validationResult.headings?.failed === 0 ? 'green' : 'yellow'}
                >
                  Headings: {validationResult.headings?.successful}/
                  {validationResult.headings?.totalWorks}
                </Badge>
              </>
            )}
          </Group>
          <Group gap="xs">
            <Button
              size="xs"
              variant="light"
              leftSection={<IconExternalLink size={12} />}
              onClick={handleOpenPDF}
            >
              Open Galley
            </Button>
            <Button
              size="xs"
              leftSection={<IconFileTypePdf size={12} />}
              onClick={handleExportPDF}
              loading={exporting}
            >
              Make Galley
            </Button>
          </Group>
        </Group>
      </Paper>

      <Tabs value={activeSubTab} onChange={onSubTabChange}>
        <Tabs.List mb="md">
          <Tabs.Tab value="titlepage" leftSection={<IconTypography size={16} />}>
            Title Page
          </Tabs.Tab>
          <Tabs.Tab value="copyright" leftSection={<IconCopyright size={16} />}>
            Copyright
          </Tabs.Tab>
          <Tabs.Tab value="dedication" leftSection={<IconHeart size={16} />}>
            Dedication
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="titlepage">
          <TitlePagePanel
            book={book}
            collectionName={collectionName}
            collectionId={collectionId}
            templateStyles={templateStyles}
            onBookChange={handleBookChange}
            onTemplateStylesChange={handleTemplateStylesChange}
          />
        </Tabs.Panel>

        <Tabs.Panel value="copyright">
          <CopyrightPanel book={book} onBookChange={handleBookChange} />
        </Tabs.Panel>

        <Tabs.Panel value="dedication">
          <DedicationPanel book={book} onBookChange={handleBookChange} />
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}
