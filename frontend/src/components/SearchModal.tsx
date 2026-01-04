import { useState, useEffect, useCallback } from 'react';
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
import { IconSearch, IconFileText, IconBuilding } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { Search } from '@wailsjs/go/main/App';
import { LogErr } from '@/utils';
import { models } from '@wailsjs/go/models';

interface SearchModalProps {
  opened: boolean;
  onClose: () => void;
}

export function SearchModal({ opened, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<models.SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!opened) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [opened]);

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
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  const navigateToResult = useCallback(
    (result: models.SearchResult) => {
      onClose();
      if (result.entityType === 'work') {
        navigate(`/works/${result.entityID}`);
      } else if (result.entityType === 'organization') {
        navigate(`/organizations?id=${result.entityID}`);
      }
    },
    [navigate, onClose]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      navigateToResult(results[selectedIndex]);
    }
  };

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
    >
      <Stack gap="sm">
        <TextInput
          placeholder="Search works and organizations..."
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          leftSection={loading ? <Loader size="xs" /> : <IconSearch size={16} />}
          rightSection={<Kbd size="xs">↵</Kbd>}
          autoFocus
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
                  {result.entityType === 'work' ? (
                    <IconFileText size={20} color="var(--mantine-color-blue-6)" />
                  ) : (
                    <IconBuilding size={20} color="var(--mantine-color-green-6)" />
                  )}
                  <Stack gap={0} style={{ flex: 1 }}>
                    <Group gap="xs">
                      <Text size="sm" fw={500}>
                        {result.title}
                      </Text>
                      <Badge
                        size="xs"
                        variant="light"
                        color={result.entityType === 'work' ? 'blue' : 'green'}
                      >
                        {result.entityType}
                      </Badge>
                    </Group>
                    {result.subtitle && (
                      <Text size="xs" c="dimmed">
                        {result.subtitle}
                      </Text>
                    )}
                  </Stack>
                </Group>
              </UnstyledButton>
            ))}
          </Stack>
        )}

        {query.trim() && !loading && results.length === 0 && (
          <Text size="sm" c="dimmed" ta="center" py="md">
            No results found for {query}
          </Text>
        )}

        {!query.trim() && (
          <Text size="xs" c="dimmed" ta="center" py="md">
            Type to search works and organizations
          </Text>
        )}
      </Stack>
    </Modal>
  );
}
