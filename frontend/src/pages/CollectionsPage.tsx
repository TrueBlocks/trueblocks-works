import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Title,
  TextInput,
  Group,
  Text,
  Stack,
  Paper,
  Box,
  Flex,
  Loader,
  CloseButton,
} from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { IconSearch, IconFolder } from '@tabler/icons-react';
import { LogErr } from '@/utils';
import {
  GetCollections,
  GetCollectionWorks,
  GetAppState,
  SetLastCollectionID,
  SetCollectionsFilter,
} from '@wailsjs/go/main/App';
import { models } from '@wailsjs/go/models';
import { CollectionSidebar, WorksTable, PDFPreview } from '@/components';
import { useNavigate } from 'react-router';

export function CollectionsPage() {
  const [collections, setCollections] = useState<models.Collection[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [works, setWorks] = useState<models.Work[]>([]);
  const [loadedWorksForId, setLoadedWorksForId] = useState<number | null>(null);
  const [selectedWorkId, setSelectedWorkId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useHotkeys([['mod+/', () => searchRef.current?.focus()]]);

  const worksLoading = selectedId !== null && selectedId !== loadedWorksForId;

  useEffect(() => {
    Promise.all([GetCollections(), GetAppState()])
      .then(([colls, appState]) => {
        const collections = colls || [];
        setCollections(collections);
        if (appState.collectionsFilter) {
          setSearch(appState.collectionsFilter);
        }
        if (
          appState.lastCollectionID &&
          collections.some((c) => c.collID === appState.lastCollectionID)
        ) {
          setSelectedId(appState.lastCollectionID);
        } else if (collections.length > 0) {
          setSelectedId(collections[0].collID);
        }
      })
      .catch((err) => LogErr('Failed to load collections:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedId === null) return;
    let cancelled = false;
    SetLastCollectionID(selectedId);
    GetCollectionWorks(selectedId)
      .then((data) => {
        if (!cancelled) {
          setWorks(data || []);
          setLoadedWorksForId(selectedId);
        }
      })
      .catch((err) => LogErr('Failed to load collection works:', err));
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const handleSelectCollection = useCallback((id: number | null) => {
    setSelectedId(id);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    SetCollectionsFilter(value);
  }, []);

  const handleWorkClick = useCallback((work: models.Work) => {
    setSelectedWorkId(work.workID);
  }, []);

  const handleWorkDoubleClick = useCallback(
    (work: models.Work) => {
      navigate(`/works/${work.workID}`);
    },
    [navigate]
  );

  const filtered = collections.filter((c) =>
    c.collectionName.toLowerCase().includes(search.toLowerCase())
  );

  const selectedCollection = collections.find((c) => c.collID === selectedId);

  if (loading) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Loader />
      </Flex>
    );
  }

  return (
    <Flex h="100%" gap="md">
      <Paper w={280} p="md" withBorder style={{ flexShrink: 0 }}>
        <Stack gap="sm">
          <TextInput
            ref={searchRef}
            placeholder="Filter collections..."
            leftSection={<IconSearch size={16} />}
            rightSection={
              search ? (
                <CloseButton size="sm" c="dimmed" onClick={() => handleSearchChange('')} />
              ) : null
            }
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          <CollectionSidebar
            collections={filtered}
            selectedId={selectedId}
            onSelect={handleSelectCollection}
          />
          <Text size="xs" c="dimmed">
            {filtered.length} of {collections.length} collections
          </Text>
        </Stack>
      </Paper>

      <Box style={{ flex: 1, overflow: 'auto' }}>
        <Stack gap="md">
          <Group>
            <IconFolder size={24} />
            <Title order={2}>{selectedCollection?.collectionName || 'Select a Collection'}</Title>
          </Group>

          {worksLoading ? (
            <Flex justify="center" py="xl">
              <Loader />
            </Flex>
          ) : (
            <Flex gap="md" style={{ flex: 1 }}>
              <Box style={{ flex: 1 }}>
                <WorksTable
                  works={works}
                  onRowClick={handleWorkClick}
                  onDoubleClick={handleWorkDoubleClick}
                  selectedId={selectedWorkId}
                />
              </Box>
              {selectedWorkId && (
                <Paper w={400} p="sm" withBorder style={{ flexShrink: 0 }}>
                  <PDFPreview workID={selectedWorkId} height="100%" />
                </Paper>
              )}
            </Flex>
          )}
        </Stack>
      </Box>
    </Flex>
  );
}
