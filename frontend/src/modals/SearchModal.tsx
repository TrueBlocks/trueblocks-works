import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  TextInput,
  Stack,
  Group,
  Text,
  Badge,
  UnstyledButton,
  Kbd,
  Loader,
  Pill,
  SegmentedControl,
  Alert,
  Button,
} from '@mantine/core';
import {
  IconSearch,
  IconFileText,
  IconBuilding,
  IconNote,
  IconSend,
  IconHistory,
  IconX,
  IconDatabase,
  IconList,
  IconAlertCircle,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { Search, AddSearchHistory, GetSearchHistory, FTSGetStatus, FTSSearch } from '@app';
import { LogErr } from '@/utils';
import { models, fts } from '@models';
import classes from './SearchModal.module.css';

interface SearchModalProps {
  opened: boolean;
  onClose: () => void;
}

export function SearchModal({ opened, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'metadata' | 'content'>('metadata');
  const [results, setResults] = useState<models.SearchResult[]>([]);
  const [ftsResults, setFtsResults] = useState<fts.Result[]>([]);
  const [ftsAvailable, setFtsAvailable] = useState<boolean | null>(null);
  const [parsedQuery, setParsedQuery] = useState<models.ParsedQuery | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (opened) {
      GetSearchHistory()
        .then((h) => setHistory(h || []))
        .catch((err) => LogErr('Failed to load search history:', err));

      FTSGetStatus()
        .then((status) => setFtsAvailable(status?.available ?? false))
        .catch(() => setFtsAvailable(false));

      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery('');
      setResults([]);
      setFtsResults([]);
      setParsedQuery(null);
      setSelectedIndex(0);
    }
  }, [opened]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setFtsResults([]);
      setParsedQuery(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        if (searchMode === 'metadata') {
          const response = await Search(query, 20);
          setResults(response?.results || []);
          setParsedQuery(response?.parsedQuery || null);
          setFtsResults([]);
        } else {
          const ftsQuery = fts.Query.createFrom({
            text: query,
            filters: { types: [], years: [], statuses: [], workIds: [] },
            limit: 20,
            offset: 0,
            includeContent: false,
          });
          const response = await FTSSearch(ftsQuery);
          setFtsResults(response?.results || []);
          setResults([]);
          setParsedQuery(null);
        }
        setSelectedIndex(0);
      } catch (err) {
        LogErr('Search failed:', err);
        setResults([]);
        setFtsResults([]);
        setParsedQuery(null);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, searchMode]);

  const removeFilter = useCallback(
    (filterType: 'entityFilter' | 'phrases' | 'exclusions', value: string) => {
      if (!parsedQuery) return;

      let newQuery = query;

      if (filterType === 'entityFilter') {
        const patterns = [`in:${value}`, `in:journals`];
        for (const pattern of patterns) {
          const regex = new RegExp(`\\s*${pattern}\\s*`, 'gi');
          newQuery = newQuery.replace(regex, ' ');
        }
      } else if (filterType === 'phrases') {
        const regex = new RegExp(`\\s*"${value}"\\s*`, 'g');
        newQuery = newQuery.replace(regex, ' ');
      } else if (filterType === 'exclusions') {
        const patterns = [`-"${value}"`, `-${value}`];
        for (const pattern of patterns) {
          const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`\\s*${escaped}\\s*`, 'g');
          newQuery = newQuery.replace(regex, ' ');
        }
      }

      setQuery(newQuery.trim());
    },
    [query, parsedQuery]
  );

  const hasActiveFilters =
    parsedQuery &&
    ((parsedQuery.entityFilter?.length || 0) > 0 ||
      (parsedQuery.phrases?.length || 0) > 0 ||
      (parsedQuery.exclusions?.length || 0) > 0);

  const navigateToResult = useCallback(
    (result: models.SearchResult) => {
      if (query.trim()) {
        AddSearchHistory(query.trim()).catch((err) =>
          LogErr('Failed to save search history:', err)
        );
      }

      onClose();

      if (result.entityType === 'work') {
        navigate(`/works/${result.entityID}`);
      } else if (result.entityType === 'organization') {
        navigate(`/organizations/${result.entityID}`);
      } else if (result.entityType === 'note') {
        if (result.parentEntityType === 'work') {
          navigate(`/works/${result.parentEntityID}`);
        } else if (result.parentEntityType === 'journal') {
          navigate(`/organizations/${result.parentEntityID}`);
        }
      } else if (result.entityType === 'submission') {
        navigate(`/submissions/${result.entityID}`);
      }
    },
    [navigate, onClose, query]
  );

  const navigateToFtsResult = useCallback(
    (result: fts.Result) => {
      if (query.trim()) {
        AddSearchHistory(query.trim()).catch((err) =>
          LogErr('Failed to save search history:', err)
        );
      }
      onClose();
      navigate(`/works/${result.workId}`);
    },
    [navigate, onClose, query]
  );

  const handleHistoryClick = useCallback((historyQuery: string) => {
    setQuery(historyQuery);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const currentResults = searchMode === 'metadata' ? results : ftsResults;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const maxIndex = currentResults.length > 0 ? currentResults.length - 1 : history.length - 1;
      setSelectedIndex((i) => Math.min(i + 1, maxIndex));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchMode === 'metadata' && results.length > 0 && results[selectedIndex]) {
        navigateToResult(results[selectedIndex]);
      } else if (searchMode === 'content' && ftsResults.length > 0 && ftsResults[selectedIndex]) {
        navigateToFtsResult(ftsResults[selectedIndex]);
      } else if (!query.trim() && history.length > 0 && history[selectedIndex]) {
        setQuery(history[selectedIndex]);
      }
    }
  };

  const showHistory = !query.trim() && history.length > 0;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconSearch size={20} />
          <Text>Search</Text>
        </Group>
      }
      size="lg"
      padding="md"
      trapFocus
    >
      <Stack gap="sm">
        <Group gap="sm">
          <TextInput
            ref={inputRef}
            placeholder={
              searchMode === 'metadata'
                ? 'Search works, journals, notes... (try in:works)'
                : 'Search document content...'
            }
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            leftSection={loading ? <Loader size="xs" /> : <IconSearch size={16} />}
            rightSection={<Kbd size="xs">↵</Kbd>}
            data-autofocus
            style={{ flex: 1 }}
          />
          <SegmentedControl
            size="xs"
            value={searchMode}
            onChange={(v) => {
              setSearchMode(v as 'metadata' | 'content');
              setSelectedIndex(0);
            }}
            data={[
              { value: 'metadata', label: <IconList size={16} /> },
              { value: 'content', label: <IconDatabase size={16} /> },
            ]}
          />
        </Group>

        {searchMode === 'content' && !ftsAvailable && (
          <Alert icon={<IconAlertCircle size={16} />} color="yellow">
            <Group justify="space-between" align="center">
              <Text size="sm">Content search requires building the search index.</Text>
              <Button
                size="xs"
                variant="light"
                onClick={() => {
                  onClose();
                  navigate('/settings');
                }}
              >
                Go to Settings
              </Button>
            </Group>
          </Alert>
        )}

        {searchMode === 'metadata' && hasActiveFilters && (
          <Group gap="xs" className={classes.filterChips}>
            {parsedQuery?.entityFilter?.map((filter) => (
              <Pill
                key={`filter-${filter}`}
                withRemoveButton
                onRemove={() => removeFilter('entityFilter', filter)}
                className={classes.filterPill}
              >
                in:{filter}
              </Pill>
            ))}
            {parsedQuery?.phrases?.map((phrase) => (
              <Pill
                key={`phrase-${phrase}`}
                withRemoveButton
                onRemove={() => removeFilter('phrases', phrase)}
                className={classes.phrasePill}
              >
                &quot;{phrase}&quot;
              </Pill>
            ))}
            {parsedQuery?.exclusions?.map((exclusion) => (
              <Pill
                key={`exclusion-${exclusion}`}
                withRemoveButton
                onRemove={() => removeFilter('exclusions', exclusion)}
                className={classes.exclusionPill}
              >
                <IconX size={10} /> {exclusion}
              </Pill>
            ))}
          </Group>
        )}

        {results.length > 0 && searchMode === 'metadata' && (
          <Stack gap={4}>
            {results.map((result, index) => (
              <UnstyledButton
                key={`${result.entityType}-${result.entityID}`}
                onClick={() => navigateToResult(result)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 4,
                  backgroundColor:
                    index === selectedIndex ? 'var(--mantine-color-blue-light)' : 'transparent',
                }}
              >
                <Group gap="sm">
                  {result.entityType === 'work' && (
                    <IconFileText size={20} color="var(--mantine-color-blue-6)" />
                  )}
                  {result.entityType === 'organization' && (
                    <IconBuilding size={20} color="var(--mantine-color-green-6)" />
                  )}
                  {result.entityType === 'note' && (
                    <IconNote size={20} color="var(--mantine-color-yellow-6)" />
                  )}
                  {result.entityType === 'submission' && (
                    <IconSend size={20} color="var(--mantine-color-violet-6)" />
                  )}
                  <Stack gap={0} style={{ flex: 1 }}>
                    <Group gap="xs">
                      <Text size="sm" fw={500}>
                        {result.title}
                      </Text>
                      <Badge
                        size="xs"
                        variant="light"
                        color={
                          result.entityType === 'work'
                            ? 'blue'
                            : result.entityType === 'organization'
                              ? 'green'
                              : result.entityType === 'note'
                                ? 'yellow'
                                : 'violet'
                        }
                      >
                        {result.entityType === 'organization' ? 'journal' : result.entityType}
                      </Badge>
                    </Group>
                    {result.subtitle && (
                      <Text size="xs" c="dimmed">
                        {result.subtitle}
                      </Text>
                    )}
                    {result.snippet && (
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {result.snippet}
                      </Text>
                    )}
                  </Stack>
                </Group>
              </UnstyledButton>
            ))}
          </Stack>
        )}

        {ftsResults.length > 0 && searchMode === 'content' && (
          <Stack gap={4}>
            {ftsResults.map((result, index) => (
              <UnstyledButton
                key={`fts-${result.workId}`}
                onClick={() => navigateToFtsResult(result)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 4,
                  backgroundColor:
                    index === selectedIndex ? 'var(--mantine-color-blue-light)' : 'transparent',
                }}
              >
                <Group gap="sm">
                  <IconFileText size={20} color="var(--mantine-color-blue-6)" />
                  <Stack gap={0} style={{ flex: 1 }}>
                    <Group gap="xs">
                      <Text size="sm" fw={500}>
                        {result.title}
                      </Text>
                      <Badge size="xs" variant="light" color="blue">
                        {result.type}
                      </Badge>
                      {result.year && (
                        <Badge size="xs" variant="outline" color="gray">
                          {result.year}
                        </Badge>
                      )}
                    </Group>
                    {result.snippet && (
                      <Text
                        size="xs"
                        c="dimmed"
                        lineClamp={2}
                        dangerouslySetInnerHTML={{ __html: result.snippet }}
                      />
                    )}
                  </Stack>
                </Group>
              </UnstyledButton>
            ))}
          </Stack>
        )}

        {showHistory && (
          <Stack gap={4}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
              Recent Searches
            </Text>
            {history.map((historyQuery, index) => (
              <UnstyledButton
                key={`history-${index}`}
                onClick={() => handleHistoryClick(historyQuery)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 4,
                  backgroundColor:
                    index === selectedIndex ? 'var(--mantine-color-blue-light)' : 'transparent',
                }}
              >
                <Group gap="sm">
                  <IconHistory size={16} color="var(--mantine-color-dimmed)" />
                  <Text size="sm">{historyQuery}</Text>
                </Group>
              </UnstyledButton>
            ))}
          </Stack>
        )}

        {query.trim() &&
          !loading &&
          ((searchMode === 'metadata' && results.length === 0) ||
            (searchMode === 'content' && ftsResults.length === 0 && ftsAvailable)) && (
            <Text size="sm" c="dimmed" ta="center" py="md">
              No results found for &quot;{query}&quot;
            </Text>
          )}

        {!query.trim() && searchMode === 'metadata' && history.length === 0 && (
          <Text size="xs" c="dimmed" ta="center" py="md">
            Type to search works, journals, notes, and submissions
          </Text>
        )}

        {!query.trim() && searchMode === 'content' && ftsAvailable && history.length === 0 && (
          <Text size="xs" c="dimmed" ta="center" py="md">
            Type to search document content
          </Text>
        )}
      </Stack>
    </Modal>
  );
}
