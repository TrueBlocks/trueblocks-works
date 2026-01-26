import { useState, useEffect, useCallback } from 'react';
import {
  Stack,
  Paper,
  Select,
  Grid,
  Text,
  Loader,
  Flex,
  NumberInput,
  Switch,
  Divider,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { GetBookByCollection, UpdateBook } from '@app';
import { models } from '@models';
import { LogErr } from '@/utils';

interface BookTypographyTabProps {
  collectionId: number;
}

const FONT_OPTIONS = [
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Courier', label: 'Courier' },
  { value: 'Palatino', label: 'Palatino' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Garamond', label: 'Garamond' },
];

export function BookTypographyTab({ collectionId }: BookTypographyTabProps) {
  const [book, setBook] = useState<models.Book | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleNumberFieldChange = useCallback(
    async (field: keyof models.Book, value: number | string) => {
      if (!book) return;
      const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
      if (isNaN(numValue)) return;
      const updated = { ...book, [field]: numValue };
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

  const handleBoolFieldChange = useCallback(
    async (field: keyof models.Book, value: boolean) => {
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
    <Stack gap="md">
      {/* TITLE PAGE */}
      <Paper p="md" withBorder>
        <Text fw={600} size="sm" mb="md">
          Title Page
        </Text>
        <Text size="xs" c="dimmed" mb="md">
          Typography settings for the book&apos;s title page.
        </Text>
        <Grid gutter="md">
          <Grid.Col span={4}>
            <Select
              size="sm"
              label="Title Font"
              value={book.titleFont || 'Times New Roman'}
              onChange={(value) => handleFieldChange('titleFont', value || 'Times New Roman')}
              data={FONT_OPTIONS}
            />
          </Grid.Col>
          <Grid.Col span={2}>
            <NumberInput
              size="sm"
              label="Title Size"
              value={book.titleSize ?? 24}
              onChange={(value) => handleNumberFieldChange('titleSize', value)}
              min={18}
              max={36}
              suffix=" pt"
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <Select
              size="sm"
              label="Subtitle Font"
              value={book.subtitleFont || 'Times New Roman'}
              onChange={(value) => handleFieldChange('subtitleFont', value || 'Times New Roman')}
              data={FONT_OPTIONS}
            />
          </Grid.Col>
          <Grid.Col span={2}>
            <NumberInput
              size="sm"
              label="Subtitle Size"
              value={book.subtitleSize ?? 14}
              onChange={(value) => handleNumberFieldChange('subtitleSize', value)}
              min={10}
              max={24}
              suffix=" pt"
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <Select
              size="sm"
              label="Author Font"
              value={book.authorFont || 'Times New Roman'}
              onChange={(value) => handleFieldChange('authorFont', value || 'Times New Roman')}
              data={FONT_OPTIONS}
            />
          </Grid.Col>
          <Grid.Col span={2}>
            <NumberInput
              size="sm"
              label="Author Size"
              value={book.authorSize ?? 12}
              onChange={(value) => handleNumberFieldChange('authorSize', value)}
              min={10}
              max={18}
              suffix=" pt"
            />
          </Grid.Col>
        </Grid>
      </Paper>

      {/* RUNNING HEADERS & PAGE NUMBERS */}
      <Paper p="md" withBorder>
        <Text fw={600} size="sm" mb="md">
          Running Headers & Page Numbers
        </Text>
        <Text size="xs" c="dimmed" mb="md">
          Typography for headers and footers that appear on each page.
        </Text>
        <Grid gutter="md">
          <Grid.Col span={4}>
            <Select
              size="sm"
              label="Header Font"
              value={book.headerFont || 'Times New Roman'}
              onChange={(value) => handleFieldChange('headerFont', value || 'Times New Roman')}
              data={FONT_OPTIONS}
            />
          </Grid.Col>
          <Grid.Col span={2}>
            <NumberInput
              size="sm"
              label="Header Size"
              value={book.headerSize ?? 10}
              onChange={(value) => handleNumberFieldChange('headerSize', value)}
              min={8}
              max={14}
              suffix=" pt"
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <Select
              size="sm"
              label="Page Number Font"
              value={book.pageNumFont || 'Times New Roman'}
              onChange={(value) => handleFieldChange('pageNumFont', value || 'Times New Roman')}
              data={FONT_OPTIONS}
            />
          </Grid.Col>
          <Grid.Col span={2}>
            <NumberInput
              size="sm"
              label="Page Number Size"
              value={book.pageNumSize ?? 10}
              onChange={(value) => handleNumberFieldChange('pageNumSize', value)}
              min={8}
              max={14}
              suffix=" pt"
            />
          </Grid.Col>
        </Grid>
      </Paper>

      {/* PAGE LAYOUT */}
      <Paper p="md" withBorder>
        <Text fw={600} size="sm" mb="md">
          Page Layout
        </Text>
        <Text size="xs" c="dimmed" mb="md">
          Control how pages are laid out in the exported PDF.
        </Text>
        <Stack gap="md">
          <Switch
            label="Start each work on a recto (right-hand) page"
            description="When enabled, blank pages will be inserted as needed so each work begins on an odd-numbered page."
            checked={book.worksStartRecto ?? true}
            onChange={(event) =>
              handleBoolFieldChange('worksStartRecto', event.currentTarget.checked)
            }
          />
          <Divider />
          <Switch
            label="Show page numbers"
            description="Display page numbers in the footer of each page."
            checked={book.showPageNumbers ?? true}
            onChange={(event) =>
              handleBoolFieldChange('showPageNumbers', event.currentTarget.checked)
            }
          />
        </Stack>
      </Paper>
    </Stack>
  );
}
