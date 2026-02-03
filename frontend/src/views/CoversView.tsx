import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Stack,
  Paper,
  Text,
  Loader,
  Flex,
  Group,
  Button,
  TextInput,
  Textarea,
  ColorInput,
  Grid,
  Badge,
  Box,
  Select,
} from '@mantine/core';
import { IconFileTypePdf, IconExternalLink, IconPhoto, IconChecks } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { OnFileDrop, OnFileDropOff } from '@wailsjs/runtime/runtime';
import {
  GetBookByCollection,
  UpdateBook,
  SelectCoverImage,
  GetCoverImageData,
  ExportCoverPDF,
  OpenCoverPDF,
  GetCoverPDFPath,
  ValidateCover,
  GetGalleyInfo,
  ValidateCoverImagePath,
} from '@app';
import { models, app } from '@models';
import { LogErr, generateCoverHTML, getCoverDimensions, DEFAULT_COVER_DIMENSIONS } from '@/utils';
import { PagePreview } from '@trueblocks/ui';

interface CoversViewProps {
  collectionId: number;
  collectionName: string;
  onNavigateToAmazon: () => void;
}

export function CoversView({ collectionId, onNavigateToAmazon }: CoversViewProps) {
  const [book, setBook] = useState<models.Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<app.ValidationResult | null>(null);
  const [frontCoverData, setFrontCoverData] = useState<string>('');
  const [coverPdfExists, setCoverPdfExists] = useState(false);
  const [galleyInfo, setGalleyInfo] = useState<app.GalleyInfo | null>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<models.Book | null>(null);

  useEffect(() => {
    bookRef.current = book;
  }, [book]);

  useEffect(() => {
    const handleFileDrop = async (_x: number, _y: number, paths: string[]) => {
      const currentBook = bookRef.current;
      if (!currentBook || paths.length === 0) return;

      const path = paths[0];
      try {
        const valid = await ValidateCoverImagePath(path);
        if (!valid) {
          notifications.show({ message: 'Invalid image file type', color: 'red' });
          return;
        }

        const updated = { ...currentBook, frontCoverPath: path };
        await UpdateBook(updated);
        setBook(updated);
        const data = await GetCoverImageData(path);
        setFrontCoverData(data);
        notifications.show({ message: 'Front cover updated', color: 'green' });
      } catch (err) {
        LogErr('Failed to set cover from drop:', err);
        notifications.show({ message: `Failed to set cover: ${err}`, color: 'red' });
      }
    };

    OnFileDrop(handleFileDrop, true);
    return () => {
      OnFileDropOff();
    };
  }, []);

  const loadBook = useCallback(async () => {
    try {
      const result = await GetBookByCollection(collectionId);
      setBook(result);

      if (result?.frontCoverPath) {
        try {
          const data = await GetCoverImageData(result.frontCoverPath);
          setFrontCoverData(data);
        } catch {
          setFrontCoverData('');
        }
      }

      const pdfPath = await GetCoverPDFPath(collectionId);
      setCoverPdfExists(!!pdfPath);

      const gInfo = await GetGalleyInfo(collectionId);
      setGalleyInfo(gInfo);
    } catch (err) {
      LogErr('Failed to load book:', err);
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    loadBook();
  }, [loadBook]);

  const handleBookChange = useCallback(
    async (field: keyof models.Book, value: string | undefined) => {
      if (!book) return;
      const updated = { ...book, [field]: value || undefined };
      setBook(updated);
      try {
        await UpdateBook(updated);
        if (field === 'paperType' || field === 'trimSize') {
          const gInfo = await GetGalleyInfo(collectionId);
          setGalleyInfo(gInfo);
        }
      } catch (err) {
        LogErr('Failed to update book:', err);
      }
    },
    [book, collectionId]
  );

  const handleSelectFrontCover = useCallback(async () => {
    if (!book) return;
    try {
      const path = await SelectCoverImage('front');
      if (path) {
        const updated = { ...book, frontCoverPath: path };
        await UpdateBook(updated);
        setBook(updated);
        const data = await GetCoverImageData(path);
        setFrontCoverData(data);
        notifications.show({ message: 'Front cover updated', color: 'green' });
      }
    } catch (err) {
      LogErr('Failed to select front cover:', err);
      notifications.show({ message: 'Failed to update cover', color: 'red' });
    }
  }, [book]);

  const handleMakeCover = useCallback(async () => {
    if (!book) return;
    if (!galleyInfo?.exists) {
      notifications.show({
        title: 'Galley Required',
        message: 'Export a galley PDF first before creating the cover',
        color: 'red',
      });
      return;
    }
    setExporting(true);
    try {
      const html = generateCoverHTML({
        book,
        frontCoverDataUrl: frontCoverData,
        isPreview: false,
        dimensions: {
          spineMM: galleyInfo.spineMM,
          widthMM: galleyInfo.widthMM,
          heightMM: galleyInfo.heightMM,
        },
      });
      const result = await ExportCoverPDF(collectionId, html);
      if (result?.success) {
        setCoverPdfExists(true);
        notifications.show({
          title: 'Cover PDF Created',
          message: `Saved to ${result.outputPath}`,
          color: 'green',
        });
        await OpenCoverPDF(collectionId);
      } else {
        notifications.show({
          title: 'Cover Export Failed',
          message: result?.error || 'Unknown error',
          color: 'red',
        });
      }
    } catch (err) {
      LogErr('Failed to export cover:', err);
      notifications.show({ message: 'Failed to create cover PDF', color: 'red' });
    } finally {
      setExporting(false);
    }
  }, [book, collectionId, frontCoverData, galleyInfo]);

  const handleOpenCover = useCallback(async () => {
    try {
      const result = await OpenCoverPDF(collectionId);
      if (!result?.success) {
        notifications.show({
          message: result?.error || 'Failed to open cover',
          color: 'red',
        });
      }
    } catch (err) {
      LogErr('Failed to open cover:', err);
    }
  }, [collectionId]);

  const handleValidate = useCallback(async () => {
    setValidating(true);
    setValidationResult(null);
    try {
      const result = await ValidateCover(collectionId);
      setValidationResult(result);
      notifications.show({
        title: result.passed ? 'Validation Passed' : 'Validation Issues Found',
        message: result.passed
          ? 'All cover checks passed'
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
      <Flex justify="center" py="xl">
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

  // Use galley dimensions if available, otherwise defaults for preview
  const coverDimensions = galleyInfo?.exists
    ? getCoverDimensions(galleyInfo.spineMM)
    : DEFAULT_COVER_DIMENSIONS;

  const coverHTML = generateCoverHTML({
    book,
    frontCoverDataUrl: frontCoverData,
    isPreview: true,
    dimensions: galleyInfo?.exists
      ? { spineMM: galleyInfo.spineMM, widthMM: galleyInfo.widthMM, heightMM: galleyInfo.heightMM }
      : undefined,
  });

  return (
    <>
      <Grid gutter="md">
        <Grid.Col span={6}>
          <Stack gap="sm">
            <Paper p="sm" withBorder>
              <Stack gap="xs">
                <Text fw={600} size="sm">
                  Cover
                </Text>
                <Group gap="xs" align="flex-end">
                  <TextInput
                    size="xs"
                    label="Publisher"
                    value={book.publisher || ''}
                    onChange={(e) => handleBookChange('publisher', e.currentTarget.value)}
                    placeholder="Stony Lane Press"
                    style={{ flex: 1 }}
                  />
                  <TextInput
                    size="xs"
                    label="ISBN"
                    value={book.isbn || ''}
                    onChange={(e) => handleBookChange('isbn', e.currentTarget.value)}
                    placeholder="ISBN-PENDING"
                    style={{ flex: 1 }}
                  />
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconPhoto size={12} />}
                    onClick={handleSelectFrontCover}
                  >
                    {book.frontCoverPath ? 'Change' : 'Image'}
                  </Button>
                </Group>
                <Textarea
                  size="xs"
                  label="Back Cover Description"
                  value={book.descriptionLong || ''}
                  onChange={(e) => handleBookChange('descriptionLong', e.currentTarget.value)}
                  placeholder="Book description for the back cover..."
                  minRows={6}
                  autosize
                  maxRows={12}
                />
                <Text size="xs" c="dimmed">
                  {(book.descriptionLong || '').split(/\s+/).filter(Boolean).length} words
                </Text>
                <ColorInput
                  size="xs"
                  label="Background Color"
                  value={book.backgroundColor || '#F5F5DC'}
                  onChange={(value) => handleBookChange('backgroundColor', value)}
                  swatches={[
                    '#F5F5DC',
                    '#FAF0E6',
                    '#FFF8DC',
                    '#FFFAF0',
                    '#F5F5F5',
                    '#E8E8E8',
                    '#2C2C2C',
                    '#1A1A2E',
                  ]}
                />
                <Select
                  size="xs"
                  label="Paper Type"
                  value={book.paperType || 'premium-color'}
                  onChange={(value) => handleBookChange('paperType', value || 'premium-color')}
                  data={[
                    { value: 'premium-color', label: 'Premium Color (white)' },
                    { value: 'standard-color', label: 'Standard Color (white)' },
                    { value: 'bw-white', label: 'Black & White (white)' },
                    { value: 'bw-cream', label: 'Black & White (cream)' },
                  ]}
                  allowDeselect={false}
                />
                <Select
                  size="xs"
                  label="Trim Size"
                  value={book.trimSize || '6x9'}
                  onChange={(value) => handleBookChange('trimSize', value || '6x9')}
                  data={[
                    { value: '5x8', label: '5" × 8"' },
                    { value: '5.5x8.5', label: '5.5" × 8.5"' },
                    { value: '6x9', label: '6" × 9"' },
                    { value: '7x10', label: '7" × 10"' },
                    { value: '8.5x11', label: '8.5" × 11"' },
                  ]}
                  allowDeselect={false}
                />
              </Stack>
            </Paper>
          </Stack>
        </Grid.Col>
        <Grid.Col span={6}>
          <Stack gap="xs">
            {!galleyInfo?.exists && (
              <Text size="xs" c="orange" ta="center">
                ⚠️ Export a galley PDF first for accurate cover dimensions
              </Text>
            )}
            {galleyInfo?.exists && (
              <Text size="xs" c="dimmed" ta="center">
                {galleyInfo.pageCount} pages · Spine: {galleyInfo.spineMM.toFixed(2)}mm · Cover:{' '}
                {galleyInfo.widthMM.toFixed(2)}×{galleyInfo.heightMM.toFixed(2)}mm
              </Text>
            )}
            <Box
              ref={dropZoneRef}
              style={
                {
                  '--wails-drop-target': 'drop',
                  position: 'relative',
                  borderRadius: 'var(--mantine-radius-sm)',
                  border: '2px dashed var(--mantine-color-gray-4)',
                  padding: '4px',
                } as React.CSSProperties
              }
            >
              <PagePreview
                html={coverHTML}
                canvasWidthMM={coverDimensions.widthMM + 16}
                canvasHeightMM={coverDimensions.heightMM + 16}
                fillWidth
              />
            </Box>
            <Text size="xs" c="dimmed" ta="center">
              Drop an image here to set as front cover
            </Text>
          </Stack>
        </Grid.Col>
      </Grid>
      <Paper p="xs" mt="md" withBorder>
        <Group justify="space-between">
          <Group gap="xs">
            <Button
              size="xs"
              variant="light"
              leftSection={<IconChecks size={12} />}
              onClick={handleValidate}
              loading={validating}
            >
              Validate
            </Button>
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
              onClick={handleOpenCover}
              disabled={!coverPdfExists}
            >
              Open Cover
            </Button>
            <Button
              size="xs"
              leftSection={<IconFileTypePdf size={12} />}
              onClick={handleMakeCover}
              loading={exporting}
            >
              Make Cover
            </Button>
          </Group>
        </Group>
      </Paper>
    </>
  );
}
