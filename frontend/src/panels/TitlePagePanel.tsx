import { useState, useCallback } from 'react';
import {
  Grid,
  TextInput,
  Stack,
  Text,
  Paper,
  Button,
  Group,
  ActionIcon,
  Tooltip,
  Switch,
  Select,
  Collapse,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { SelectBookTemplate, ValidateTemplate, GetTitlePageStyles, ClearPartCache } from '@app';
import { models, app } from '@models';
import { LogErr } from '@/utils';
import { generateTitlePageHTML } from '@/utils/titlePageHTML';
import { PagePreview } from '@trueblocks/ui';
import { IconFileText, IconChevronUp, IconChevronDown, IconRefresh } from '@tabler/icons-react';

const OFFSET_STEP = 4;

interface OffsetControlProps {
  field: 'titleOffsetY' | 'subtitleOffsetY' | 'authorOffsetY';
  value: number | undefined;
  onOffsetChange: (
    field: 'titleOffsetY' | 'subtitleOffsetY' | 'authorOffsetY',
    delta: number
  ) => void;
  onOffsetReset: (field: 'titleOffsetY' | 'subtitleOffsetY' | 'authorOffsetY') => void;
}

function OffsetControl({ field, value, onOffsetChange, onOffsetReset }: OffsetControlProps) {
  return (
    <Group gap={2}>
      <Text size="xs" c="dimmed" w={32} ta="right">
        {value ?? 0}
      </Text>
      <ActionIcon size="xs" variant="subtle" onClick={() => onOffsetChange(field, -OFFSET_STEP)}>
        <IconChevronUp size={12} />
      </ActionIcon>
      <ActionIcon size="xs" variant="subtle" onClick={() => onOffsetChange(field, OFFSET_STEP)}>
        <IconChevronDown size={12} />
      </ActionIcon>
      <Tooltip label="Reset offset">
        <ActionIcon
          size="xs"
          variant="subtle"
          onClick={() => onOffsetReset(field)}
          disabled={(value ?? 0) === 0}
        >
          <IconRefresh size={12} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

interface TitlePagePanelProps {
  book: models.Book;
  collectionName: string;
  collectionId: number;
  templateStyles: app.TitlePageStyleInfo | null;
  onBookChange: (book: models.Book) => void;
  onTemplateStylesChange: (styles: app.TitlePageStyleInfo | null) => void;
}

export function TitlePagePanel({
  book,
  collectionName,
  collectionId,
  templateStyles,
  onBookChange,
  onTemplateStylesChange,
}: TitlePagePanelProps) {
  const [_templateValidation, setTemplateValidation] = useState<app.TemplateValidation | null>(
    null
  );
  const [validating, setValidating] = useState(false);

  const handleFieldChange = useCallback(
    (field: keyof models.Book, value: string) => {
      const updated = { ...book, [field]: value };
      onBookChange(updated);
    },
    [book, onBookChange]
  );

  const handleOffsetChange = useCallback(
    (field: 'titleOffsetY' | 'subtitleOffsetY' | 'authorOffsetY', delta: number) => {
      const current = book[field] ?? 0;
      const updated = { ...book, [field]: current + delta };
      onBookChange(updated);
    },
    [book, onBookChange]
  );

  const handleOffsetReset = useCallback(
    (field: 'titleOffsetY' | 'subtitleOffsetY' | 'authorOffsetY') => {
      const updated = { ...book, [field]: 0 };
      onBookChange(updated);
    },
    [book, onBookChange]
  );

  const handleSelectTemplate = useCallback(async () => {
    try {
      const path = await SelectBookTemplate();
      if (!path) return;

      setValidating(true);
      const [validation, styles] = await Promise.all([
        ValidateTemplate(path),
        GetTitlePageStyles(path),
      ]);
      setTemplateValidation(validation);
      onTemplateStylesChange(styles);
      setValidating(false);

      if (!validation.isValid) {
        notifications.show({
          title: 'Invalid Template',
          message:
            validation.requiredMissing?.length > 0
              ? `Missing required styles: ${validation.requiredMissing.join(', ')}`
              : validation.errors?.join(', ') || 'Template file is invalid',
          color: 'red',
          autoClose: 8000,
        });
        return;
      }

      const updated = { ...book, templatePath: path };
      onBookChange(updated);
    } catch (err) {
      LogErr('Failed to select template:', err);
      setValidating(false);
    }
  }, [book, onBookChange, onTemplateStylesChange]);

  return (
    <Grid gutter="md">
      <Grid.Col span={6}>
        <Stack gap="sm">
          <Paper p="sm" withBorder>
            <Stack gap="xs">
              <Text fw={600} size="sm">
                Title Page
              </Text>
              <Group gap="xs" align="flex-end">
                <TextInput
                  size="xs"
                  label="Title"
                  value={book.title || ''}
                  onChange={(e) => handleFieldChange('title', e.currentTarget.value)}
                  placeholder={collectionName}
                  style={{ flex: 1 }}
                />
                <OffsetControl
                  field="titleOffsetY"
                  value={book.titleOffsetY}
                  onOffsetChange={handleOffsetChange}
                  onOffsetReset={handleOffsetReset}
                />
              </Group>
              <Group gap="xs" align="flex-end">
                <TextInput
                  size="xs"
                  label="Subtitle"
                  value={book.subtitle || ''}
                  onChange={(e) => handleFieldChange('subtitle', e.currentTarget.value)}
                  placeholder="Optional"
                  style={{ flex: 1 }}
                />
                <OffsetControl
                  field="subtitleOffsetY"
                  value={book.subtitleOffsetY}
                  onOffsetChange={handleOffsetChange}
                  onOffsetReset={handleOffsetReset}
                />
              </Group>
              <Group gap="xs" align="flex-end">
                <TextInput
                  size="xs"
                  label="Author"
                  value={book.author || ''}
                  onChange={(e) => handleFieldChange('author', e.currentTarget.value)}
                  style={{ flex: 1 }}
                />
                <OffsetControl
                  field="authorOffsetY"
                  value={book.authorOffsetY}
                  onOffsetChange={handleOffsetChange}
                  onOffsetReset={handleOffsetReset}
                />
              </Group>
            </Stack>
          </Paper>
          <Paper p="sm" withBorder>
            <Stack gap="xs">
              <Text fw={600} size="sm">
                Build Options
              </Text>
              <Grid>
                <Grid.Col span={9}>
                  <Select
                    size="xs"
                    label="Book Type"
                    description="Poetry and Prose set common defaults; Custom enables all options"
                    value={book.bookType || 'prose'}
                    onChange={(value) => {
                      const newType = value || 'prose';
                      let updated = { ...book, bookType: newType };
                      if (newType === 'poetry') {
                        updated = {
                          ...updated,
                          versoHeader: 'none',
                          rectoHeader: 'essay_title',
                          suppressPageNumbers: 'section_starts',
                          worksStartRecto: false,
                        };
                      } else if (newType === 'prose') {
                        updated = {
                          ...updated,
                          versoHeader: 'book_title',
                          rectoHeader: 'essay_title',
                          suppressPageNumbers: 'both',
                          worksStartRecto: true,
                        };
                      }
                      onBookChange(updated);
                      ClearPartCache(collectionId, []);
                    }}
                    data={[
                      { value: 'poetry', label: 'Poetry' },
                      { value: 'prose', label: 'Prose' },
                      { value: 'custom', label: 'Custom' },
                    ]}
                    allowDeselect={false}
                  />
                </Grid.Col>
                <Grid.Col span={3}>
                  <Stack gap={4}>
                    <Text size="xs" fw={500}>
                      Template
                    </Text>
                    {book.templatePath && (
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {book.templatePath.split('/').pop()}
                      </Text>
                    )}
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconFileText size={12} />}
                      onClick={handleSelectTemplate}
                      loading={validating}
                      fullWidth
                    >
                      Change
                    </Button>
                  </Stack>
                </Grid.Col>
              </Grid>
              <Collapse in={book.bookType === 'custom'}>
                <Stack gap="xs" mt="xs">
                  <Switch
                    size="xs"
                    label="Works start on recto"
                    description="Insert blanks so works begin on right pages"
                    checked={book.worksStartRecto ?? true}
                    onChange={(e) => {
                      const updated = { ...book, worksStartRecto: e.currentTarget.checked };
                      onBookChange(updated);
                      ClearPartCache(collectionId, []);
                    }}
                  />
                  <Group grow gap="md">
                    <Select
                      size="xs"
                      label="Verso Header"
                      description="Left page header content"
                      value={book.versoHeader || 'none'}
                      onChange={(value) => {
                        const updated = { ...book, versoHeader: value || 'none' };
                        onBookChange(updated);
                        ClearPartCache(collectionId, []);
                      }}
                      data={[
                        { value: 'book_title', label: 'Book Title' },
                        { value: 'section_title', label: 'Section Title' },
                        { value: 'essay_title', label: 'Essay Title' },
                        { value: 'none', label: 'None' },
                      ]}
                      allowDeselect={false}
                    />
                    <Select
                      size="xs"
                      label="Recto Header"
                      description="Right page header content"
                      value={book.rectoHeader || 'none'}
                      onChange={(value) => {
                        const updated = { ...book, rectoHeader: value || 'none' };
                        onBookChange(updated);
                        ClearPartCache(collectionId, []);
                      }}
                      data={[
                        { value: 'book_title', label: 'Book Title' },
                        { value: 'section_title', label: 'Section Title' },
                        { value: 'essay_title', label: 'Essay Title' },
                        { value: 'none', label: 'None' },
                      ]}
                      allowDeselect={false}
                    />
                  </Group>
                  <Group grow gap="md">
                    <Select
                      size="xs"
                      label="Page Number Position"
                      description="Where page numbers appear in footer"
                      value={book.pageNumberPosition || 'centered'}
                      onChange={(value) => {
                        const updated = { ...book, pageNumberPosition: value || 'centered' };
                        onBookChange(updated);
                        ClearPartCache(collectionId, []);
                      }}
                      data={[
                        { value: 'centered', label: 'Centered' },
                        { value: 'outer', label: 'Outer Edge' },
                        { value: 'none', label: 'None' },
                      ]}
                      allowDeselect={false}
                    />
                    <Select
                      size="xs"
                      label="Suppress Page Numbers"
                      description="When to hide page numbers"
                      value={book.suppressPageNumbers || 'never'}
                      onChange={(value) => {
                        const updated = { ...book, suppressPageNumbers: value || 'never' };
                        onBookChange(updated);
                        ClearPartCache(collectionId, []);
                      }}
                      data={[
                        { value: 'never', label: 'Never' },
                        { value: 'section_starts', label: 'Section Starts' },
                        { value: 'essay_starts', label: 'Essay Starts' },
                        { value: 'both', label: 'Both' },
                      ]}
                      allowDeselect={false}
                    />
                  </Group>
                </Stack>
              </Collapse>
              <Group grow>
                <Select
                  size="xs"
                  label="Paper Type"
                  value={book.paperType || 'premium-color'}
                  onChange={(value) => handleFieldChange('paperType', value || 'premium-color')}
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
                  onChange={(value) => {
                    handleFieldChange('trimSize', value || '6x9');
                    ClearPartCache(collectionId, []);
                  }}
                  data={[
                    { value: '5x8', label: '5" × 8"' },
                    { value: '5.5x8.5', label: '5.5" × 8.5"' },
                    { value: '6x9', label: '6" × 9"' },
                    { value: '7x10', label: '7" × 10"' },
                    { value: '8.5x11', label: '8.5" × 11"' },
                  ]}
                  allowDeselect={false}
                />
              </Group>
            </Stack>
          </Paper>
        </Stack>
      </Grid.Col>
      <Grid.Col span={6}>
        <PagePreview
          html={generateTitlePageHTML({
            book,
            collectionName,
            templateStyles,
          })}
          canvasWidthMM={152.4}
          canvasHeightMM={228.6}
        />
      </Grid.Col>
    </Grid>
  );
}
