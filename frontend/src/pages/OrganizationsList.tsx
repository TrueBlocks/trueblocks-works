import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Table, Group, ActionIcon, Tooltip } from '@mantine/core';
import { IconWorld, IconBook } from '@tabler/icons-react';
import { useLocation } from 'react-router-dom';
import { BrowserOpenURL } from '@wailsjs/runtime/runtime';
import {
  GetOrganizationsWithNotes,
  GetOrgsFilterOptions,
  SetLastOrgID,
  GetAppState,
} from '@wailsjs/go/main/App';
import { models } from '@wailsjs/go/models';
import { OrgStatusBadge, DataTable, Column, TypeBadge } from '@/components';
import { Log, LogErr } from '@/utils';

const getOrgValue = (org: models.OrganizationWithNotes, column: string): unknown => {
  if (column === 'nPushcarts') {
    return org.nPushFiction + org.nPushNonfiction + org.nPushPoetry;
  }
  return (org as unknown as Record<string, unknown>)[column];
};

interface OrganizationsListProps {
  onOrgClick: (org: models.OrganizationWithNotes) => void;
  onFilteredDataChange: (orgs: models.OrganizationWithNotes[]) => void;
}

export function OrganizationsList({ onOrgClick, onFilteredDataChange }: OrganizationsListProps) {
  const location = useLocation();
  const [orgs, setOrgs] = useState<models.OrganizationWithNotes[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOptions, setFilterOptions] = useState<{
    statuses: string[];
    types: string[];
    timings: string[];
  }>({ statuses: [], types: [], timings: [] });
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    Promise.all([GetOrganizationsWithNotes(), GetOrgsFilterOptions()])
      .then(([data, options]) => {
        Log('Organizations loaded:', data?.length || 0);
        setOrgs(data || []);
        setFilterOptions({
          statuses: options.statuses || [],
          types: options.types || [],
          timings: options.timings || [],
        });

        const state = location.state as { selectID?: number } | null;
        if (state?.selectID) {
          SetLastOrgID(state.selectID);
          window.history.replaceState({}, document.title);
        }
      })
      .catch((err) => {
        LogErr('Failed to load organizations:', err);
      })
      .finally(() => setLoading(false));
  }, [location.state]);

  const searchFn = useCallback((org: models.OrganizationWithNotes, search: string) => {
    return org.name.toLowerCase().includes(search.toLowerCase());
  }, []);

  const handleSelectedChange = useCallback((org: models.OrganizationWithNotes) => {
    SetLastOrgID(org.orgID).catch((err) => {
      LogErr('Failed to set lastOrgID:', err);
    });
  }, []);

  const getLastSelectedID = useCallback(async () => {
    const state = await GetAppState();
    return state.lastOrgID;
  }, []);

  const columns: Column<models.OrganizationWithNotes>[] = useMemo(
    () => [
      { key: 'orgID', label: 'ID', width: '5%', render: (o) => o.orgID },
      { key: 'name', label: 'Name', width: '25%', render: (o) => o.name },
      {
        key: 'type',
        label: 'Type',
        width: '10%',
        render: (o) => <TypeBadge value={o.type} />,
        filterOptions: filterOptions.types,
      },
      {
        key: 'status',
        label: 'Status',
        width: '10%',
        render: (o) => <OrgStatusBadge status={o.status} />,
        filterOptions: filterOptions.statuses,
      },
      {
        key: 'timing',
        label: 'Timing',
        width: '10%',
        render: (o) => <TypeBadge value={o.timing} />,
        filterOptions: filterOptions.timings,
      },
      {
        key: 'nSubmissions',
        label: 'Subs',
        width: '8%',
        render: (o) => o.nSubmissions || '-',
        filterRange: true,
      },
      {
        key: 'nPushcarts',
        label: 'Pushcarts',
        width: '8%',
        render: (o) => o.nPushFiction + o.nPushNonfiction + o.nPushPoetry || '-',
        filterRange: true,
      },
      {
        key: 'notes',
        label: 'Notes',
        width: '20%',
        render: (o) => (
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block',
            }}
          >
            {o.notes || '-'}
          </span>
        ),
      },
    ],
    [filterOptions]
  );

  const renderExtraCells = useCallback(
    (org: models.OrganizationWithNotes) => (
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
    ),
    []
  );

  return (
    <DataTable<models.OrganizationWithNotes>
      tableName="organizations"
      title="Organizations"
      data={orgs}
      columns={columns}
      loading={loading}
      getRowKey={(o) => o.orgID}
      onRowClick={onOrgClick}
      onSelectedChange={handleSelectedChange}
      getLastSelectedID={getLastSelectedID}
      onFilteredSortedChange={onFilteredDataChange}
      searchFn={searchFn}
      valueGetter={getOrgValue}
      extraColumns={<Table.Th style={{ width: '10%' }}>Actions</Table.Th>}
      renderExtraCells={renderExtraCells}
    />
  );
}
