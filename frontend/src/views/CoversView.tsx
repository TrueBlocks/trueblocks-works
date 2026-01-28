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
  Image,
  Box,
  Alert,
  ActionIcon,
  Tooltip,
  Divider,
} from '@mantine/core';
import {
  IconPhoto,
  IconUpload,
  IconX,
  IconCopy,
  IconExternalLink,
  IconAlertCircle,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  GetBookByCollection,
  UpdateBook,
  SelectCoverImage,
  GetCoverImageData,
  SaveCoverFromBytes,
  CopyCoverToClipboard,
} from '@app';
import { models } from '@models';
import { LogErr, Log } from '@/utils';
import { BrowserOpenURL } from '@wailsjs/runtime/runtime';

interface CoversViewProps {
  collectionId: number;
  collectionName: string;
}

interface CoverDropZoneProps {
  label: string;
  imagePath?: string;
  imageData?: string;
  onSelect: () => void;
  onDrop: (file: File) => void;
  onClear: () => void;
  onCopy: () => void;
}

function CoverDropZone({
  label,
  imagePath,
  imageData,
  onSelect,
  onDrop,
  onClear,
  onCopy,
}: CoverDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
        if (validTypes.includes(file.type)) {
          onDrop(file);
        } else {
          notifications.show({
            message: 'Please drop a PNG, JPG, or PDF file',
            color: 'red',
          });
        }
      }
    },
    [onDrop]
  );

  const isPdf = imagePath?.toLowerCase().endsWith('.pdf');

  return (
    <Paper
      p="md"
      withBorder
      ref={dropRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        borderStyle: isDragging ? 'dashed' : 'solid',
        borderColor: isDragging ? 'var(--mantine-color-blue-5)' : undefined,
        backgroundColor: isDragging ? 'var(--mantine-color-blue-0)' : undefined,
        transition: 'all 0.2s ease',
      }}
    >
      <Group justify="space-between" mb="sm">
        <Text fw={600} size="sm">
          {label}
        </Text>
        <Group gap="xs">
          {imagePath && (
            <>
              <Tooltip label="Copy path to clipboard">
                <ActionIcon variant="subtle" size="sm" onClick={onCopy}>
                  <IconCopy size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Clear image">
                <ActionIcon variant="subtle" size="sm" color="red" onClick={onClear}>
                  <IconX size={16} />
                </ActionIcon>
              </Tooltip>
            </>
          )}
        </Group>
      </Group>

      {imageData && !isPdf ? (
        <Box
          mb="sm"
          style={{
            width: 180,
            height: 270,
            margin: '0 auto',
          }}
        >
          <Image
            src={imageData}
            alt={label}
            fit="contain"
            w={180}
            h={270}
            radius="sm"
            style={{ backgroundColor: 'var(--mantine-color-gray-1)' }}
          />
        </Box>
      ) : imagePath && isPdf ? (
        <Box
          mb="sm"
          style={{
            width: 180,
            height: 270,
            margin: '0 auto',
            backgroundColor: 'var(--mantine-color-gray-1)',
            borderRadius: 'var(--mantine-radius-sm)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconPhoto size={48} color="var(--mantine-color-gray-5)" />
          <Text size="sm" c="dimmed" mt="xs">
            PDF Cover
          </Text>
        </Box>
      ) : (
        <Box
          mb="sm"
          style={{
            width: 180,
            height: 270,
            margin: '0 auto',
            backgroundColor: 'var(--mantine-color-gray-1)',
            borderRadius: 'var(--mantine-radius-sm)',
            border: '2px dashed var(--mantine-color-gray-4)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconUpload size={32} color="var(--mantine-color-gray-5)" />
          <Text size="sm" c="dimmed" mt="xs">
            Drag & drop image here
          </Text>
          <Text size="xs" c="dimmed">
            PNG, JPG, or PDF
          </Text>
          <Text size="xs" c="dimmed" mt="md">
            6&quot; × 9&quot; format
          </Text>
        </Box>
      )}

      {imagePath && (
        <Text size="xs" c="dimmed" mb="sm" style={{ wordBreak: 'break-all' }}>
          {imagePath}
        </Text>
      )}

      <Button
        variant="light"
        size="xs"
        leftSection={<IconPhoto size={14} />}
        onClick={onSelect}
        fullWidth
      >
        {imagePath ? 'Change Image' : 'Select Image'}
      </Button>
    </Paper>
  );
}

export function CoversView({ collectionId, collectionName: _collectionName }: CoversViewProps) {
  void _collectionName;
  const [book, setBook] = useState<models.Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [frontCoverData, setFrontCoverData] = useState<string>('');
  const [backCoverData, setBackCoverData] = useState<string>('');

  const loadBook = useCallback(async () => {
    try {
      const result = await GetBookByCollection(collectionId);
      setBook(result);

      if (result?.frontCoverPath) {
        try {
          const data = await GetCoverImageData(result.frontCoverPath);
          setFrontCoverData(data);
        } catch {
          Log('Could not load front cover image data');
        }
      }
      if (result?.backCoverPath) {
        try {
          const data = await GetCoverImageData(result.backCoverPath);
          setBackCoverData(data);
        } catch {
          Log('Could not load back cover image data');
        }
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

  const handleSelectBackCover = useCallback(async () => {
    if (!book) return;
    try {
      const path = await SelectCoverImage('back');
      if (path) {
        const updated = { ...book, backCoverPath: path };
        await UpdateBook(updated);
        setBook(updated);
        const data = await GetCoverImageData(path);
        setBackCoverData(data);
        notifications.show({ message: 'Back cover updated', color: 'green' });
      }
    } catch (err) {
      LogErr('Failed to select back cover:', err);
      notifications.show({ message: 'Failed to update cover', color: 'red' });
    }
  }, [book]);

  const handleDropFrontCover = useCallback(
    async (file: File) => {
      if (!book) return;
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = e.target?.result as string;
          const savedPath = await SaveCoverFromBytes(collectionId, 'front', base64, file.name);
          const updated = { ...book, frontCoverPath: savedPath };
          await UpdateBook(updated);
          setBook(updated);
          setFrontCoverData(base64);
          notifications.show({ message: 'Front cover saved', color: 'green' });
        };
        reader.readAsDataURL(file);
      } catch (err) {
        LogErr('Failed to save front cover:', err);
        notifications.show({ message: 'Failed to save cover', color: 'red' });
      }
    },
    [book, collectionId]
  );

  const handleDropBackCover = useCallback(
    async (file: File) => {
      if (!book) return;
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = e.target?.result as string;
          const savedPath = await SaveCoverFromBytes(collectionId, 'back', base64, file.name);
          const updated = { ...book, backCoverPath: savedPath };
          await UpdateBook(updated);
          setBook(updated);
          setBackCoverData(base64);
          notifications.show({ message: 'Back cover saved', color: 'green' });
        };
        reader.readAsDataURL(file);
      } catch (err) {
        LogErr('Failed to save back cover:', err);
        notifications.show({ message: 'Failed to save cover', color: 'red' });
      }
    },
    [book, collectionId]
  );

  const handleClearFrontCover = useCallback(async () => {
    if (!book) return;
    try {
      const updated = { ...book, frontCoverPath: undefined };
      await UpdateBook(updated);
      setBook(updated);
      setFrontCoverData('');
      notifications.show({ message: 'Front cover cleared', color: 'blue' });
    } catch (err) {
      LogErr('Failed to clear front cover:', err);
    }
  }, [book]);

  const handleClearBackCover = useCallback(async () => {
    if (!book) return;
    try {
      const updated = { ...book, backCoverPath: undefined };
      await UpdateBook(updated);
      setBook(updated);
      setBackCoverData('');
      notifications.show({ message: 'Back cover cleared', color: 'blue' });
    } catch (err) {
      LogErr('Failed to clear back cover:', err);
    }
  }, [book]);

  const handleCopyFrontCover = useCallback(async () => {
    if (book?.frontCoverPath) {
      await CopyCoverToClipboard(book.frontCoverPath);
      notifications.show({ message: 'Path copied to clipboard', color: 'blue' });
    }
  }, [book]);

  const handleCopyBackCover = useCallback(async () => {
    if (book?.backCoverPath) {
      await CopyCoverToClipboard(book.backCoverPath);
      notifications.show({ message: 'Path copied to clipboard', color: 'blue' });
    }
  }, [book]);

  const handleSpineTextChange = useCallback(
    async (value: string) => {
      if (!book) return;
      const updated = { ...book, spineText: value || undefined };
      setBook(updated);
      try {
        await UpdateBook(updated);
      } catch (err) {
        LogErr('Failed to update spine text:', err);
      }
    },
    [book]
  );

  const handleDescriptionShortChange = useCallback(
    async (value: string) => {
      if (!book) return;
      const updated = { ...book, descriptionShort: value || undefined };
      setBook(updated);
      try {
        await UpdateBook(updated);
      } catch (err) {
        LogErr('Failed to update short description:', err);
      }
    },
    [book]
  );

  const handleDescriptionLongChange = useCallback(
    async (value: string) => {
      if (!book) return;
      const updated = { ...book, descriptionLong: value || undefined };
      setBook(updated);
      try {
        await UpdateBook(updated);
      } catch (err) {
        LogErr('Failed to update long description:', err);
      }
    },
    [book]
  );

  if (loading) {
    return (
      <Flex justify="center" py="xl">
        <Loader />
      </Flex>
    );
  }

  return (
    <Stack gap="md">
      <Paper p="md" withBorder>
        <Group gap="xs" mb="md">
          <IconPhoto size={20} />
          <Text fw={600}>Cover Images</Text>
        </Group>

        <Alert icon={<IconAlertCircle size={18} />} color="blue" mb="md">
          <Text size="sm">
            For Amazon KDP paperbacks, you&apos;ll need a single PDF with front cover, spine, and
            back cover combined. Use the individual images here to create your wraparound cover in
            design software.
          </Text>
        </Alert>

        <Group grow align="flex-start">
          <CoverDropZone
            label="Back Cover"
            imagePath={book?.backCoverPath}
            imageData={backCoverData}
            onSelect={handleSelectBackCover}
            onDrop={handleDropBackCover}
            onClear={handleClearBackCover}
            onCopy={handleCopyBackCover}
          />

          <CoverDropZone
            label="Front Cover"
            imagePath={book?.frontCoverPath}
            imageData={frontCoverData}
            onSelect={handleSelectFrontCover}
            onDrop={handleDropFrontCover}
            onClear={handleClearFrontCover}
            onCopy={handleCopyFrontCover}
          />
        </Group>
      </Paper>

      <Paper p="md" withBorder>
        <Text fw={600} size="sm" mb="md">
          Spine Text
        </Text>
        <TextInput
          placeholder="Text to appear on the spine (for thick books)"
          value={book?.spineText || ''}
          onChange={(e) => handleSpineTextChange(e.target.value)}
          description="Usually the book title and author name. Spine width depends on page count."
        />
      </Paper>

      <Paper p="md" withBorder>
        <Text fw={600} size="sm" mb="md">
          Back Cover Descriptions
        </Text>
        <Stack gap="md">
          <Box>
            <Group justify="space-between" mb={4}>
              <Text size="sm" fw={500}>
                Short Description
              </Text>
              <Tooltip label="Copy to clipboard">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => {
                    if (book?.descriptionShort) {
                      navigator.clipboard.writeText(book.descriptionShort);
                      notifications.show({ message: 'Short description copied', color: 'blue' });
                    }
                  }}
                  disabled={!book?.descriptionShort}
                >
                  <IconCopy size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
            <Textarea
              placeholder="A brief 2-3 sentence hook for the book..."
              value={book?.descriptionShort || ''}
              onChange={(e) => handleDescriptionShortChange(e.target.value)}
              description="Used for tight spaces or marketing copy."
              minRows={3}
              autosize
            />
          </Box>
          <Box>
            <Group justify="space-between" mb={4}>
              <Text size="sm" fw={500}>
                Long Description
              </Text>
              <Tooltip label="Copy to clipboard">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => {
                    if (book?.descriptionLong) {
                      navigator.clipboard.writeText(book.descriptionLong);
                      notifications.show({ message: 'Long description copied', color: 'blue' });
                    }
                  }}
                  disabled={!book?.descriptionLong}
                >
                  <IconCopy size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
            <Textarea
              placeholder="Full back cover description..."
              value={book?.descriptionLong || ''}
              onChange={(e) => handleDescriptionLongChange(e.target.value)}
              description="The complete back cover text."
              minRows={8}
              autosize
            />
          </Box>
        </Stack>
      </Paper>

      <Paper p="md" withBorder>
        <Text fw={600} size="sm" mb="md">
          KDP Cover Requirements
        </Text>
        <Divider mb="md" />

        <Stack gap="xs">
          <Text size="sm">
            <strong>Paperback cover:</strong> Single PDF with front, spine, and back
          </Text>
          <Text size="sm">
            <strong>eBook cover:</strong> Front cover only, 2560 × 1600 pixels (1.6:1 ratio)
          </Text>
          <Text size="sm">
            <strong>Resolution:</strong> Minimum 300 DPI for print
          </Text>
          <Text size="sm">
            <strong>Bleed:</strong> 0.125&quot; on all sides for paperback
          </Text>

          <Group mt="sm">
            <Button
              variant="light"
              size="xs"
              leftSection={<IconExternalLink size={14} />}
              onClick={() => BrowserOpenURL('https://kdp.amazon.com/en_US/help/topic/G201953020')}
            >
              KDP Cover Guidelines
            </Button>
            <Button
              variant="light"
              size="xs"
              leftSection={<IconExternalLink size={14} />}
              onClick={() => BrowserOpenURL('https://kdp.amazon.com/cover-calculator')}
            >
              Cover Size Calculator
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Stack>
  );
}
