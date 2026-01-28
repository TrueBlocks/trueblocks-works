import { Modal, Text, Stack, List, Button, Group } from '@mantine/core';
import type { app } from '@models';

type ImportResult = app.ImportResult;

interface ImportReviewModalProps {
  opened: boolean;
  onClose: () => void;
  result: ImportResult | null;
  onNavigateToCollection: (collectionID: number) => void;
  onAddType: (type: string) => void;
  onAddExtension: (extension: string) => void;
  onCancelImport: () => void;
}

export function ImportReviewModal({
  opened,
  onClose,
  result,
  onNavigateToCollection,
  onAddType,
  onAddExtension,
  onCancelImport,
}: ImportReviewModalProps) {
  if (!result) return null;

  const hasInvalid = result.invalid.length > 0;
  const hasImported = result.imported > 0 || result.updated > 0;
  const needsType = result.status === 'needs_type';
  const needsExtension = result.status === 'needs_extension';

  if (needsType && result.unknownType) {
    return (
      <Modal
        opened={opened}
        onClose={() => {
          onCancelImport();
          onClose();
        }}
        title="Unknown Type Found"
        size="md"
      >
        <Stack gap="md">
          <Text size="sm">
            Unknown type{' '}
            <Text span fw={700} c="blue">
              {result.unknownType}
            </Text>{' '}
            found in file{' '}
            <Text span fw={500}>
              {result.currentFile}
            </Text>
            .
          </Text>
          <Text size="sm" c="dimmed">
            Add this type to the database to continue importing?
          </Text>

          <Group justify="flex-end" mt="md">
            <Button
              variant="subtle"
              onClick={() => {
                onCancelImport();
                onClose();
              }}
            >
              Cancel Import
            </Button>
            <Button variant="filled" onClick={() => onAddType(result.unknownType!)}>
              Add Type &amp; Continue
            </Button>
          </Group>
        </Stack>
      </Modal>
    );
  }

  if (needsExtension && result.unknownExtension) {
    return (
      <Modal
        opened={opened}
        onClose={() => {
          onCancelImport();
          onClose();
        }}
        title="Unknown File Extension Found"
        size="md"
      >
        <Stack gap="md">
          <Text size="sm">
            Unknown file extension{' '}
            <Text span fw={700} c="blue">
              .{result.unknownExtension}
            </Text>{' '}
            found in file{' '}
            <Text span fw={500}>
              {result.currentFile}
            </Text>
            .
          </Text>
          <Text size="sm" c="dimmed">
            Add this extension to the database to continue importing?
          </Text>

          <Group justify="flex-end" mt="md">
            <Button
              variant="subtle"
              onClick={() => {
                onCancelImport();
                onClose();
              }}
            >
              Cancel Import
            </Button>
            <Button variant="filled" onClick={() => onAddExtension(result.unknownExtension!)}>
              Add Extension &amp; Continue
            </Button>
          </Group>
        </Stack>
      </Modal>
    );
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Import Results" size="md">
      <Stack gap="md">
        {hasImported && (
          <div>
            <Text size="sm">
              Imported: {result.imported} | Updated: {result.updated}
              {result.collectionName && (
                <>
                  {' '}
                  into{' '}
                  <Text span fw={600}>
                    {result.collectionName}
                  </Text>
                </>
              )}
            </Text>
          </div>
        )}

        {hasInvalid && (
          <div>
            <Text size="sm" fw={500} c="red">
              Invalid Files ({result.invalid.length})
            </Text>
            <List size="xs" spacing="xs" mt="xs">
              {result.invalid.map((file, idx) => (
                <List.Item key={idx}>
                  <Text size="xs" c="dimmed">
                    {file.filename}
                  </Text>
                  {file.errors.map((error, errorIdx) => (
                    <Text key={errorIdx} size="xs" c="red">
                      • {error}
                    </Text>
                  ))}
                </List.Item>
              ))}
            </List>
          </div>
        )}

        <Group justify="flex-end" mt="md">
          {hasImported && (
            <Button
              variant="filled"
              onClick={() => {
                onNavigateToCollection(result.collectionID);
                onClose();
              }}
            >
              View Collection
            </Button>
          )}
          <Button variant="subtle" onClick={onClose}>
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
