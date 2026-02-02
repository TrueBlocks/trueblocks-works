import { useState, useEffect, useCallback } from 'react';
import { Tabs, Box, Button, Group, Paper, Loader, Flex, Text, Badge, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconTypography,
  IconCopyright,
  IconHeart,
  IconUsers,
  IconUser,
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
  OpenBookPDF,
  GetTitlePageStyles,
  ValidateTemplate,
  ValidateMatter,
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
import {
  TitlePagePanel,
  CopyrightPanel,
  DedicationPanel,
  AcknowledgementsPanel,
  AboutAuthorPanel,
} from '@/panels';

interface MatterViewProps {
  collectionId: number;
  collectionName: string;
  activeSubTab: string;
  onSubTabChange: (value: string | null) => void;
  onNavigateToAmazon: () => void;
}

export function MatterView({
  collectionId,
  collectionName,
  activeSubTab,
  onSubTabChange,
  onNavigateToAmazon,
}: MatterViewProps) {
  const [book, setBook] = useState<models.Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [templateStyles, setTemplateStyles] = useState<app.TitlePageStyleInfo | null>(null);
  const [exporting, setExporting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [partModalOpen, setPartModalOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<app.ValidationResult | null>(null);

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

  const doExportPDF = useCallback(async () => {
    const htmlContent = buildHtmlContent();
    if (!htmlContent) return;

    setExporting(true);
    try {
      const hasParts = await HasCollectionParts(collectionId);
      const result = hasParts
        ? await ExportBookPDFWithParts(collectionId, false, htmlContent)
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
  }, [buildHtmlContent, collectionId]);

  const handleExportPDF = useCallback(async () => {
    try {
      const hasParts = await HasCollectionParts(collectionId);
      if (hasParts) {
        setPartModalOpen(true);
      } else {
        await doExportPDF();
      }
    } catch (err) {
      LogErr('PDF export check failed:', err);
      await doExportPDF();
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
      const result = await ValidateMatter(collectionId);
      setValidationResult(result);
      notifications.show({
        title: result.passed ? 'Validation Passed' : 'Validation Issues Found',
        message: result.passed
          ? 'All front matter checks passed'
          : `${result.errors.length} errors, ${result.warnings.length} warnings`,
        color: result.passed ? 'green' : result.errors.length > 0 ? 'red' : 'yellow',
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
        onConfirm={() => {
          setPartModalOpen(false);
          doExportPDF();
        }}
        collectionId={collectionId}
      />

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
          <Tabs.Tab value="ack" leftSection={<IconUsers size={16} />}>
            Acknowledgements
          </Tabs.Tab>
          <Tabs.Tab value="about" leftSection={<IconUser size={16} />}>
            About Author
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

        <Tabs.Panel value="ack">
          <AcknowledgementsPanel book={book} onBookChange={handleBookChange} />
        </Tabs.Panel>

        <Tabs.Panel value="about">
          <AboutAuthorPanel book={book} onBookChange={handleBookChange} />
        </Tabs.Panel>
      </Tabs>

      <Paper p="xs" mt="md" withBorder>
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
                  color={validationResult.passed ? 'green' : 'red'}
                  style={{ cursor: 'pointer' }}
                  onClick={onNavigateToAmazon}
                >
                  {validationResult.passed ? 'Passed' : `${validationResult.errors.length} errors`}
                </Badge>
                {validationResult.warnings.length > 0 && (
                  <Badge
                    size="xs"
                    color="yellow"
                    style={{ cursor: 'pointer' }}
                    onClick={onNavigateToAmazon}
                  >
                    {validationResult.warnings.length} warnings
                  </Badge>
                )}
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
    </Box>
  );
}
