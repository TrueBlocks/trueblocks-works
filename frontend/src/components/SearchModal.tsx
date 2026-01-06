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
} from '@mantine/core';
import {
  IconSearch,
  IconFileText,
  IconBuilding,
  IconNote,
  IconSend,
  IconHistory,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { Search, AddSearchHistory, GetSearchHistory } from '@wailsjs/go/main/App';
import { LogErr } from '@/utils';
import { models } from '@wailsjs/go/models';

interface SearchModalProps {
  opened: boolean;
  onClose: () => void;
}

export function SearchModal({ opened, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<models.SearchResult[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // Load search history when modal opens
  useEffect(() => {
    if (opened) {
      GetSearchHistory()
        .then((h) => setHistory(h || []))
        .catch((err) => LogErr('Failed to load search history:', err));

      // Focus input after a short delay to ensure modal is rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [opened]);

  // Debounced search on query change
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const searchResults = await Search(query, 20);
        setResults(searchResults || []);
        setSelectedIndex(0);
      } catch (err) {
        LogErr('Search failed:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const navigateToResult = useCallback(
    (result: models.SearchResult) => {
      // Save search to history before navigating
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
        // Navigate to the parent entity
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

  const handleHistoryClick = useCallback((historyQuery: string) => {
    setQuery(historyQuery);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const maxIndex = results.length > 0 ? results.length - 1 : history.length - 1;
      setSelectedIndex((i) => Math.min(i + 1, maxIndex));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length > 0 && results[selectedIndex]) {
        navigateToResult(results[selectedIndex]);
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
        <TextInput
<<<<<<< HEAD
=======
          ref={inputRef}
>>>>>>> d853e1b (feat: extend Cmd+K search to notes/submissions with FTS5 (fixes #7))
          placeholder="Search works, journals, notes, submissions..."
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          leftSection={loading ? <Loader size="xs" /> : <IconSearch size={16} />}
          rightSection={<Kbd size="xs">↵</Kbd>}
          data-autofocus
        />

        {results.length > 0 && (
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

        {query.trim() && !loading && results.length === 0 && (
          <Text size="sm" c="dimmed" ta="center" py="md">
            No results found for &quot;{query}&quot;
          </Text>
        )}

        {!query.trim() && history.length === 0 && (
          <Text size="xs" c="dimmed" ta="center" py="md">
            Type to search works, journals, notes, and submissions
          </Text>
        )}
      </Stack>
    </Modal>
  );
}
