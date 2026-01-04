import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Title, Table, TextInput, Group, Text, Stack, Badge, ActionIcon } from '@mantine/core';
import { IconSearch, IconPlus } from '@tabler/icons-react';
import { Log, LogErr } from '@/utils';
import { GetSubmissions, GetAppState } from '@wailsjs/go/main/App';
import { models } from '@wailsjs/go/models';
import { ResponseBadge, SortableHeader } from '@/components';
import { useTableSort, ViewSort } from '@/hooks';
import dayjs from 'dayjs';

function isActive(sub: models.Submission): boolean {
  return !sub.responseDate && !sub.responseType;
}

export function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<models.Submission[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const { handleColumnClick, getSortInfo, sortData, setInitialSort } =
    useTableSort<models.Submission>('submissions');

  useEffect(() => {
    Promise.all([GetSubmissions(), GetAppState()])
      .then(([data, appState]) => {
        Log('Submissions loaded:', data?.length || 0);
        setSubmissions(data || []);
        if (appState?.viewSorts?.submissions) {
          const vs = appState.viewSorts.submissions;
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
      .catch((err) => LogErr('Failed to load submissions:', err))
      .finally(() => setLoading(false));
  }, [setInitialSort]);

  const filtered = submissions.filter(
    (s) =>
      s.draft?.toLowerCase().includes(search.toLowerCase()) ||
      s.contestName?.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = sortData(filtered);

  const columns = [
    { key: 'workID', label: 'Work', width: '15%' },
    { key: 'orgID', label: 'Organization', width: '20%' },
    { key: 'submissionType', label: 'Type', width: '15%' },
    { key: 'submissionDate', label: 'Submitted', width: '15%' },
    { key: 'responseType', label: 'Response', width: '15%' },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Submissions</Title>
        <Group>
          <TextInput
            placeholder="Search submissions..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            w={300}
          />
          <ActionIcon variant="filled" size="lg">
            <IconPlus size={18} />
          </ActionIcon>
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
              <Table.Th style={{ width: '10%' }}>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sorted.map((sub) => (
              <Table.Tr
                key={sub.submissionID}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/submissions/${sub.submissionID}`)}
              >
                <Table.Td>Work #{sub.workID}</Table.Td>
                <Table.Td>Org #{sub.orgID}</Table.Td>
                <Table.Td>{sub.submissionType || '-'}</Table.Td>
                <Table.Td>
                  {sub.submissionDate ? dayjs(sub.submissionDate).format('MMM D, YYYY') : '-'}
                </Table.Td>
                <Table.Td>
                  <ResponseBadge response={sub.responseType} />
                </Table.Td>
                <Table.Td>
                  {isActive(sub) ? (
                    <Badge color="green" variant="light" size="sm">
                      Active
                    </Badge>
                  ) : (
                    <Badge color="gray" variant="light" size="sm">
                      Closed
                    </Badge>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      <Text size="sm" c="dimmed">
        {sorted.length} of {submissions.length} submissions
      </Text>
    </Stack>
  );
}
