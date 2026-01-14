import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Modal,
  Select,
  Button,
  Group,
  Stack,
  Table,
  Text,
  ScrollArea,
  Loader,
  Center,
  TextInput,
} from '@mantine/core';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { PreviewImportFiles, GetCollections, GetEnumLists } from '@app';
import { app, models } from '@models';
import { LogErr } from '@/utils';

type ImportPreview = app.ImportPreview;
type FilePreview = app.FilePreview;

interface EditableFile extends FilePreview {
  editedType?: string;
  editedYear?: string;
  editedQuality?: string;
  editedTitle?: string;
}

interface ImportConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: (collectionID: number, fileEdits?: Record<string, EditableFile>) => void;
}

export function ImportConfirmModal({ opened, onClose, onConfirm }: ImportConfirmModalProps) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [editableFiles, setEditableFiles] = useState<EditableFile[]>([]);
  const [collections, setCollections] = useState<models.CollectionView[]>([]);
  const [selectedCollectionID, setSelectedCollectionID] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [types, setTypes] = useState<string[]>([]);
  const [qualities, setQualities] = useState<string[]>([]);
  const firstTypeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!opened) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [previewData, collectionsData, enumLists] = await Promise.all([
          PreviewImportFiles(),
          GetCollections(),
          GetEnumLists(),
        ]);

        setPreview(previewData);
        // Apply defaults for incomplete files
        const currentYear = String(new Date().getFullYear());
        const filesWithDefaults = previewData.files.map((f: FilePreview) => ({
          ...f,
          editedYear: f.year || currentYear,
          editedQuality: f.quality || 'Okay',
        }));
        setEditableFiles(filesWithDefaults);
        setTypes(enumLists.workTypeList || []);
        setQualities(enumLists.qualityList || []);

        // Filter out deleted collections
        const activeCollections = (collectionsData || []).filter(
          (c: models.CollectionView) => !c.isDeleted
        );
        setCollections(activeCollections);

        // Default to "New Works" collection if it exists
        const newWorksCollection = activeCollections.find(
          (c: models.CollectionView) => c.collectionName === 'New Works'
        );
        if (newWorksCollection) {
          setSelectedCollectionID(String(newWorksCollection.collID));
        } else if (activeCollections.length > 0) {
          setSelectedCollectionID(String(activeCollections[0].collID));
        }
      } catch (err) {
        LogErr('Failed to load import preview:', err);
      } finally {
        setLoading(false);
        // Focus the first type dropdown after loading
        setTimeout(() => {
          firstTypeRef.current?.focus();
        }, 100);
      }
    };

    loadData();
  }, [opened]);

  const collectionOptions = useMemo(() => {
    return collections.map((c) => ({
      value: String(c.collID),
      label: c.collectionName,
    }));
  }, [collections]);

  const handleConfirm = () => {
    const collID = selectedCollectionID ? parseInt(selectedCollectionID, 10) : 0;
    const editsMap: Record<string, EditableFile> = {};
    editableFiles.forEach((f) => {
      editsMap[f.filename] = f;
    });
    onConfirm(collID, editsMap);
    onClose();
  };

  const handleClose = () => {
    setPreview(null);
    setEditableFiles([]);
    setSelectedCollectionID(null);
    onClose();
  };

  const updateFile = useCallback((idx: number, field: keyof EditableFile, value: string) => {
    setEditableFiles((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  }, []);

  const isFileComplete = useCallback((file: EditableFile) => {
    const type = file.editedType ?? file.type;
    const year = file.editedYear ?? file.year;
    const quality = file.editedQuality ?? file.quality;
    const title = file.editedTitle ?? file.title;
    return Boolean(type && year && quality && title);
  }, []);

  const readyCount = useMemo(() => {
    return editableFiles.filter(isFileComplete).length;
  }, [editableFiles, isFileComplete]);

  const typeOptions = useMemo(() => types.map((t) => ({ value: t, label: t })), [types]);
  const qualityOptions = useMemo(() => qualities.map((q) => ({ value: q, label: q })), [qualities]);
  const yearOptions = useMemo(() => {
    const years: string[] = [];
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= 1980; y--) {
      years.push(String(y));
    }
    return years.map((y) => ({ value: y, label: y }));
  }, []);

  if (!opened) return null;

  return (
    <Modal opened={opened} onClose={handleClose} title="Import Files" size="lg">
      {loading ? (
        <Center py="xl">
          <Loader size="md" />
        </Center>
      ) : !preview || preview.totalCount === 0 ? (
        <Stack gap="md">
          <Text c="dimmed">No files found in ./imports/files/</Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={handleClose}>
              Close
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack gap="md">
          <Group justify="space-between">
            <Text size="sm">
              <Text span fw={600}>
                {readyCount}
              </Text>{' '}
              of{' '}
              <Text span fw={600}>
                {preview.totalCount}
              </Text>{' '}
              files ready to import
            </Text>
            <Select
              label="Import into collection"
              data={collectionOptions}
              value={selectedCollectionID}
              onChange={setSelectedCollectionID}
              w={200}
              size="xs"
            />
          </Group>

          <ScrollArea h={400}>
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={40}></Table.Th>
                  <Table.Th w="30%">Title</Table.Th>
                  <Table.Th w="25%">Type</Table.Th>
                  <Table.Th w="15%">Year</Table.Th>
                  <Table.Th w="20%">Quality</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {editableFiles.map((file, idx) => {
                  const complete = isFileComplete(file);
                  const currentType = file.editedType ?? file.type;
                  const currentYear = file.editedYear ?? file.year;
                  const currentQuality = file.editedQuality ?? file.quality;
                  const currentTitle = file.editedTitle ?? file.title;
                  const needsTypeSelect = !file.valid || !file.type;
                  const isFirstTypeSelect =
                    needsTypeSelect && editableFiles.findIndex((f) => !f.valid || !f.type) === idx;

                  return (
                    <Table.Tr key={idx}>
                      <Table.Td>
                        {complete ? (
                          <IconCheck size={16} color="green" />
                        ) : (
                          <IconAlertCircle size={16} color="orange" />
                        )}
                      </Table.Td>
                      <Table.Td>
                        {file.valid ? (
                          <Text size="sm">{currentTitle}</Text>
                        ) : (
                          <TextInput
                            size="xs"
                            value={currentTitle || ''}
                            onChange={(e) => updateFile(idx, 'editedTitle', e.target.value)}
                            placeholder="Enter title"
                          />
                        )}
                      </Table.Td>
                      <Table.Td>
                        {file.valid && file.type ? (
                          <Text size="sm">{currentType}</Text>
                        ) : (
                          <Select
                            ref={isFirstTypeSelect ? firstTypeRef : undefined}
                            size="xs"
                            data={typeOptions}
                            value={currentType || null}
                            onChange={(v) => updateFile(idx, 'editedType', v || '')}
                            placeholder="Select type"
                            searchable
                          />
                        )}
                      </Table.Td>
                      <Table.Td>
                        {file.valid && file.year ? (
                          <Text size="sm">{currentYear}</Text>
                        ) : (
                          <Select
                            size="xs"
                            data={yearOptions}
                            value={currentYear || null}
                            onChange={(v) => updateFile(idx, 'editedYear', v || '')}
                            placeholder="Year"
                            searchable
                          />
                        )}
                      </Table.Td>
                      <Table.Td>
                        {file.valid && file.quality ? (
                          <Text size="sm">{currentQuality}</Text>
                        ) : (
                          <Select
                            size="xs"
                            data={qualityOptions}
                            value={currentQuality || null}
                            onChange={(v) => updateFile(idx, 'editedQuality', v || '')}
                            placeholder="Quality"
                          />
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={readyCount === 0}>
              Import {readyCount} {readyCount === 1 ? 'File' : 'Files'}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
