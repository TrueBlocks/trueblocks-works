import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Title, Table, TextInput, Group, Text, Stack, ActionIcon, Tooltip } from '@mantine/core';
import { IconSearch, IconWorld, IconBook } from '@tabler/icons-react';
import { BrowserOpenURL } from '@wailsjs/runtime/runtime';
import {
  GetAppState,
  GetOrganizationsWithNotes,
  SetOrgsStatusFilter,
  UpdateOrganization,
} from '@wailsjs/go/main/App';
import { models } from '@wailsjs/go/models';
import { OrgStatusBadge, SortableHeader, ColumnFilterPopover } from '@/components';
import { useTableSort, ViewSort } from '@/hooks';
import { Log, LogErr } from '@/utils';

const STATUS_OPTIONS = ['Open', 'Boring', 'Defunct'] as const;
const DEFAULT_STATUSES = ['Open', 'Boring'];

const getOrgValue = (org: models.OrganizationWithNotes, column: string): unknown => {
  if (column === 'nPushcarts') {
    return org.nPushFiction + org.nPushNonfiction + org.nPushPoetry;
  }
  return (org as unknown as Record<string, unknown>)[column];
};

export function OrganizationsPage() {
  const [orgs, setOrgs] = useState<models.OrganizationWithNotes[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showStatuses, setShowStatuses] = useState<Set<string>>(new Set(DEFAULT_STATUSES));
  const navigate = useNavigate();

  const { handleColumnClick, getSortInfo, sortData, setInitialSort } =
    useTableSort<models.OrganizationWithNotes>('organizations', undefined, getOrgValue);

  const toggleStatus = (status: string) => {
    setShowStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      SetOrgsStatusFilter(Array.from(next));
      return next;
    });
  };

  const cycleOrgStatus = (org: models.OrganizationWithNotes, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIndex = STATUS_OPTIONS.indexOf(org.status as (typeof STATUS_OPTIONS)[number]);
    const nextIndex = (currentIndex + 1) % STATUS_OPTIONS.length;
    const newStatus = STATUS_OPTIONS[nextIndex];
    const oldStatus = org.status;

    setOrgs((prev) => prev.map((o) => (o.orgID === org.orgID ? { ...o, status: newStatus } : o)));

    const updatedOrg = { ...org, status: newStatus };
    UpdateOrganization(updatedOrg as models.Organization).catch(() => {
      setOrgs((prev) => prev.map((o) => (o.orgID === org.orgID ? { ...o, status: oldStatus } : o)));
    });
  };

  useEffect(() => {
    Promise.all([GetOrganizationsWithNotes(), GetAppState()])
      .then(([data, appState]) => {
        Log('Organizations loaded:', data?.length || 0);
        setOrgs(data || []);
        if (appState?.orgsStatusFilter?.length) {
          setShowStatuses(new Set(appState.orgsStatusFilter));
        }
        if (appState?.viewSorts?.organizations) {
          const vs = appState.viewSorts.organizations;
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
      .catch((err) => {
        LogErr('Failed to load organizations:', err);
      })
      .finally(() => setLoading(false));
  }, [setInitialSort]);

  const filtered = orgs.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) && showStatuses.has(o.status || 'Open')
  );

  const sorted = sortData(filtered);

  const columns = [
    { key: 'name', label: 'Name', width: '30%' },
    { key: 'type', label: 'Type', width: '10%' },
    { key: 'status', label: 'Status', width: '10%' },
    { key: 'timing', label: 'Timing', width: '10%' },
    { key: 'nPushcarts', label: 'Pushcarts', width: '10%' },
    { key: 'notes', label: 'Notes', width: '20%' },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Organizations</Title>
        <TextInput
          placeholder="Search organizations..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          w={300}
        />
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
                    filterElement={
                      col.key === 'status' ? (
                        <ColumnFilterPopover
                          options={STATUS_OPTIONS}
                          selected={showStatuses}
                          onChange={toggleStatus}
                          label="Status"
                        />
                      ) : undefined
                    }
                  />
                );
              })}
              <Table.Th style={{ width: '10%' }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sorted.map((org) => (
              <Table.Tr
                key={org.orgID}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/organizations/${org.orgID}`)}
              >
                <Table.Td>{org.name}</Table.Td>
                <Table.Td>{org.type}</Table.Td>
                <Table.Td>
                  <Tooltip label="Click to cycle status">
                    <div
                      style={{ cursor: 'pointer', display: 'inline-block' }}
                      onClick={(e) => cycleOrgStatus(org, e)}
                    >
                      <OrgStatusBadge status={org.status} />
                    </div>
                  </Tooltip>
                </Table.Td>
                <Table.Td>{org.timing || '-'}</Table.Td>
                <Table.Td>
                  {org.nPushFiction + org.nPushNonfiction + org.nPushPoetry || '-'}
                </Table.Td>
                <Table.Td
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {org.notes || '-'}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Tooltip label="Open website">
                      <ActionIcon
                        variant="subtle"
                        disabled={!org.url}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (org.url) BrowserOpenURL(org.url);
                        }}
                      >
                        <IconWorld size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Open Duotrope">
                      <ActionIcon
                        variant="subtle"
                        disabled={!org.duotropeNum}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (org.duotropeNum) {
                            BrowserOpenURL(`https://duotrope.com/listing/${org.duotropeNum}`);
                          }
                        }}
                      >
                        <IconBook size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      <Text size="sm" c="dimmed">
        {sorted.length} of {orgs.length} organizations
      </Text>
    </Stack>
  );
}
