import { useState, useEffect, useCallback } from 'react';
import { Title, Table, TextInput, Group, Text, Stack, ActionIcon } from '@mantine/core';
import { IconSearch, IconPlus } from '@tabler/icons-react';
import { Log, LogErr } from '@/utils';
import { GetWorks, GetAppState } from '@wailsjs/go/main/App';
import { models } from '@wailsjs/go/models';
import { StatusBadge, QualityBadge, NewWorkModal, SortableHeader } from '@/components';
import { useTableSort, ViewSort } from '@/hooks';
import { useNavigate } from 'react-router';

export function WorksPage() {
  const [works, setWorks] = useState<models.Work[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const navigate = useNavigate();

  const { handleColumnClick, getSortInfo, sortData, setInitialSort } =
    useTableSort<models.Work>('works');

  const loadWorks = useCallback(() => {
    setLoading(true);
    GetWorks()
      .then((data) => setWorks(data || []))
      .catch((err) => LogErr('Failed to load works:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    Promise.all([GetWorks(), GetAppState()])
      .then(([data, appState]) => {
        Log('Works loaded:', data?.length || 0);
        setWorks(data || []);
        if (appState?.viewSorts?.works) {
          const vs = appState.viewSorts.works;
          setInitialSort({
            primary: {
              column: vs.primary?.column || '',
              direction: (vs.primary?.direction as ViewSort['primary']['direction']) || '',
            },
            secondary: {
              column: vs.secondary?.column || '',
              direction: (vs.secondary?.direction as ViewSort['secondary']['direction']) || '',
            },
          });
        }
      })
      .catch((err) => LogErr('Failed to load works:', err))
      .finally(() => setLoading(false));
  }, [setInitialSort]);

  const handleCreated = (work: models.Work) => {
    loadWorks();
    navigate(`/works/${work.workID}`);
  };

  const filtered = works.filter((w) => w.title.toLowerCase().includes(search.toLowerCase()));
  const sorted = sortData(filtered);

  const columns = [
    { key: 'title', label: 'Title', width: '40%' },
    { key: 'type', label: 'Type', width: '15%' },
    { key: 'status', label: 'Status', width: '15%' },
    { key: 'quality', label: 'Quality', width: '15%' },
    { key: 'nWords', label: 'Words', width: '15%' },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Works</Title>
        <Group>
          <ActionIcon variant="light" size="lg" onClick={() => setNewModalOpen(true)}>
            <IconPlus size={18} />
          </ActionIcon>
          <TextInput
            placeholder="Search works..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            w={300}
          />
        </Group>
      </Group>

      {loading ? (
        <Text>Loading...</Text>
      ) : (
        <Table striped highlightOnHover style={{ tableLayout: 'fixed', width: '100%' }}>
          <Table.Thead>
            <Table.Tr>
              {columns.map((col) => {
                const sortInfo = getSortInfo(col.key);
                return (
                  <SortableHeader
                    key={col.key}
                    label={col.label}
                    column={col.key}
                    level={sortInfo.level}
                    direction={sortInfo.direction}
                    onClick={handleColumnClick}
                    style={{ width: col.width }}
                  />
                );
              })}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sorted.map((work) => (
              <Table.Tr
                key={work.workID}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/works/${work.workID}`)}
              >
                <Table.Td>{work.title}</Table.Td>
                <Table.Td>{work.type}</Table.Td>
                <Table.Td>
                  <StatusBadge status={work.status} />
                </Table.Td>
                <Table.Td>
                  <QualityBadge quality={work.quality} />
                </Table.Td>
                <Table.Td>{work.nWords?.toLocaleString() || '-'}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      <Text size="sm" c="dimmed">
        {sorted.length} of {works.length} works
      </Text>

      <NewWorkModal
        opened={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        onCreated={handleCreated}
      />
    </Stack>
  );
}
