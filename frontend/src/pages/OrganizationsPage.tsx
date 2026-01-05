import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Table, Group, ActionIcon, Tooltip } from '@mantine/core';
import { IconWorld, IconBook } from '@tabler/icons-react';
import { BrowserOpenURL } from '@wailsjs/runtime/runtime';
import {
  GetAppState,
  GetOrganizationsWithNotes,
  GetOrgsFilterOptions,
  SetOrgsStatusFilter,
  SetOrgsTypeFilter,
  SetOrgsTimingFilter,
  SetOrgsSubmissionsFilter,
  SetOrgsPushcartsFilter,
  SetOrgsFilter,
  UpdateOrganization,
} from '@wailsjs/go/main/App';
import { models } from '@wailsjs/go/models';
import {
  OrgStatusBadge,
  DataTable,
  Column,
  ColumnFilterPopover,
  NumericFilterPopover,
} from '@/components';
import { ViewSort } from '@/hooks';
import { Log, LogErr, matchesFilter, matchesNumericFilter, intersectFilter } from '@/utils';

const getOrgValue = (org: models.OrganizationWithNotes, column: string): unknown => {
  if (column === 'nPushcarts') {
    return org.nPushFiction + org.nPushNonfiction + org.nPushPoetry;
  }
  return (org as unknown as Record<string, unknown>)[column];
};

export function OrganizationsPage() {
  const [orgs, setOrgs] = useState<models.OrganizationWithNotes[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialSearch, setInitialSearch] = useState('');
  const [initialSort, setInitialSort] = useState<ViewSort | undefined>(undefined);
  const navigate = useNavigate();

  // Filter state
  const [showStatuses, setShowStatuses] = useState<Set<string>>(new Set());
  const [showTypes, setShowTypes] = useState<Set<string>>(new Set());
  const [showTimings, setShowTimings] = useState<Set<string>>(new Set());
  const [submissionsMin, setSubmissionsMin] = useState<number | undefined>(undefined);
  const [submissionsMax, setSubmissionsMax] = useState<number | undefined>(undefined);
  const [pushcartsMin, setPushcartsMin] = useState<number | undefined>(undefined);
  const [pushcartsMax, setPushcartsMax] = useState<number | undefined>(undefined);

  // Available options from backend
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [availableTimings, setAvailableTimings] = useState<string[]>([]);

  // Status filter callbacks
  const toggleStatus = useCallback((status: string) => {
    setShowStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      SetOrgsStatusFilter(Array.from(next));
      return next;
    });
  }, []);

  const selectAllStatuses = useCallback(() => {
    setShowStatuses(new Set(availableStatuses));
    SetOrgsStatusFilter(availableStatuses);
  }, [availableStatuses]);

  const selectNoneStatuses = useCallback(() => {
    setShowStatuses(new Set());
    SetOrgsStatusFilter([]);
  }, []);

  const selectOnlyStatus = useCallback((status: string) => {
    setShowStatuses(new Set([status]));
    SetOrgsStatusFilter([status]);
  }, []);

  // Type filter callbacks
  const toggleType = useCallback((type: string) => {
    setShowTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      SetOrgsTypeFilter(Array.from(next));
      return next;
    });
  }, []);

  const selectAllTypes = useCallback(() => {
    setShowTypes(new Set(availableTypes));
    SetOrgsTypeFilter(availableTypes);
  }, [availableTypes]);

  const selectNoneTypes = useCallback(() => {
    setShowTypes(new Set());
    SetOrgsTypeFilter([]);
  }, []);

  const selectOnlyType = useCallback((type: string) => {
    setShowTypes(new Set([type]));
    SetOrgsTypeFilter([type]);
  }, []);

  // Timing filter callbacks
  const toggleTiming = useCallback((timing: string) => {
    setShowTimings((prev) => {
      const next = new Set(prev);
      if (next.has(timing)) next.delete(timing);
      else next.add(timing);
      SetOrgsTimingFilter(Array.from(next));
      return next;
    });
  }, []);

  const selectAllTimings = useCallback(() => {
    setShowTimings(new Set(availableTimings));
    SetOrgsTimingFilter(availableTimings);
  }, [availableTimings]);

  const selectNoneTimings = useCallback(() => {
    setShowTimings(new Set());
    SetOrgsTimingFilter([]);
  }, []);

  const selectOnlyTiming = useCallback((timing: string) => {
    setShowTimings(new Set([timing]));
    SetOrgsTimingFilter([timing]);
  }, []);

  // Submissions filter callback
  const handleSubmissionsFilterChange = useCallback(
    (min: number | undefined, max: number | undefined) => {
      setSubmissionsMin(min);
      setSubmissionsMax(max);
      SetOrgsSubmissionsFilter(min ?? null, max ?? null);
    },
    []
  );

  // Pushcarts filter callback
  const handlePushcartsFilterChange = useCallback(
    (min: number | undefined, max: number | undefined) => {
      setPushcartsMin(min);
      setPushcartsMax(max);
      SetOrgsPushcartsFilter(min ?? null, max ?? null);
    },
    []
  );

  const cycleOrgStatus = useCallback((org: models.OrganizationWithNotes, e: React.MouseEvent) => {
    e.stopPropagation();
    const statusOrder = ['Open', 'Boring', 'Defunct'];
    const currentIndex = statusOrder.indexOf(org.status || 'Open');
    const nextIndex = (currentIndex + 1) % statusOrder.length;
    const newStatus = statusOrder[nextIndex];
    const oldStatus = org.status;

    // Ensure the new status is included in the filter so the row doesn't disappear
    setShowStatuses((prev) => {
      if (prev.has(newStatus)) return prev;
      const next = new Set(prev);
      next.add(newStatus);
      SetOrgsStatusFilter(Array.from(next));
      return next;
    });

    // Also add to available options if not present
    setAvailableStatuses((prev) => (prev.includes(newStatus) ? prev : [...prev, newStatus]));

    setOrgs((prev) => prev.map((o) => (o.orgID === org.orgID ? { ...o, status: newStatus } : o)));

    const updatedOrg = { ...org, status: newStatus };
    UpdateOrganization(updatedOrg as models.Organization).catch(() => {
      setOrgs((prev) => prev.map((o) => (o.orgID === org.orgID ? { ...o, status: oldStatus } : o)));
    });
  }, []);

  useEffect(() => {
    Promise.all([GetOrganizationsWithNotes(), GetAppState(), GetOrgsFilterOptions()])
      .then(([data, appState, filterOptions]) => {
        Log('Organizations loaded:', data?.length || 0);
        setOrgs(data || []);

        // Set available options from backend
        setAvailableStatuses(filterOptions.statuses || []);
        setAvailableTypes(filterOptions.types || []);
        setAvailableTimings(filterOptions.timings || []);

        // Restore persisted search
        if (appState?.orgsFilter) {
          setInitialSearch(appState.orgsFilter);
        }

        // Set filters: intersect persisted with available (defaults to all if no valid persisted)
        setShowStatuses(intersectFilter(appState?.orgsStatusFilter, filterOptions.statuses || []));
        setShowTypes(intersectFilter(appState?.orgsTypeFilter, filterOptions.types || []));
        setShowTimings(intersectFilter(appState?.orgsTimingFilter, filterOptions.timings || []));

        // Restore numeric filters
        if (appState?.orgsSubmissionsMin !== undefined && appState?.orgsSubmissionsMin !== null) {
          setSubmissionsMin(appState.orgsSubmissionsMin);
        }
        if (appState?.orgsSubmissionsMax !== undefined && appState?.orgsSubmissionsMax !== null) {
          setSubmissionsMax(appState.orgsSubmissionsMax);
        }
        if (appState?.orgsPushcartsMin !== undefined && appState?.orgsPushcartsMin !== null) {
          setPushcartsMin(appState.orgsPushcartsMin);
        }
        if (appState?.orgsPushcartsMax !== undefined && appState?.orgsPushcartsMax !== null) {
          setPushcartsMax(appState.orgsPushcartsMax);
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
  }, []);

  const filterFn = useCallback(
    (org: models.OrganizationWithNotes, search: string) => {
      const pushcarts = org.nPushFiction + org.nPushNonfiction + org.nPushPoetry;
      return (
        org.name.toLowerCase().includes(search.toLowerCase()) &&
        matchesFilter(showStatuses, org.status) &&
        matchesFilter(showTypes, org.type) &&
        matchesFilter(showTimings, org.timing) &&
        matchesNumericFilter(org.nSubmissions, submissionsMin, submissionsMax) &&
        matchesNumericFilter(pushcarts, pushcartsMin, pushcartsMax)
      );
    },
    [
      showStatuses,
      showTypes,
      showTimings,
      submissionsMin,
      submissionsMax,
      pushcartsMin,
      pushcartsMax,
    ]
  );

  const columns: Column<models.OrganizationWithNotes>[] = useMemo(
    () => [
      { key: 'orgID', label: 'ID', width: '5%', render: (o) => o.orgID },
      { key: 'name', label: 'Name', width: '25%', render: (o) => o.name },
      {
        key: 'type',
        label: 'Type',
        width: '10%',
        render: (o) => o.type,
        filterElement: (
          <ColumnFilterPopover
            options={availableTypes}
            selected={showTypes}
            onChange={toggleType}
            onSelectAll={selectAllTypes}
            onSelectNone={selectNoneTypes}
            onSelectOnly={selectOnlyType}
            label="Type"
          />
        ),
      },
      {
        key: 'status',
        label: 'Status',
        width: '10%',
        render: (o) => (
          <Tooltip label="Click to cycle status">
            <div
              style={{ cursor: 'pointer', display: 'inline-block' }}
              onClick={(e) => cycleOrgStatus(o, e)}
            >
              <OrgStatusBadge status={o.status} />
            </div>
          </Tooltip>
        ),
        filterElement: (
          <ColumnFilterPopover
            options={availableStatuses}
            selected={showStatuses}
            onChange={toggleStatus}
            onSelectAll={selectAllStatuses}
            onSelectNone={selectNoneStatuses}
            onSelectOnly={selectOnlyStatus}
            label="Status"
          />
        ),
      },
      {
        key: 'timing',
        label: 'Timing',
        width: '10%',
        render: (o) => o.timing || '-',
        filterElement: (
          <ColumnFilterPopover
            options={availableTimings}
            selected={showTimings}
            onChange={toggleTiming}
            onSelectAll={selectAllTimings}
            onSelectNone={selectNoneTimings}
            onSelectOnly={selectOnlyTiming}
            label="Timing"
          />
        ),
      },
      {
        key: 'nSubmissions',
        label: 'Subs',
        width: '8%',
        render: (o) => o.nSubmissions || '-',
        filterElement: (
          <NumericFilterPopover
            min={submissionsMin}
            max={submissionsMax}
            onChange={handleSubmissionsFilterChange}
            label="Submissions"
          />
        ),
      },
      {
        key: 'nPushcarts',
        label: 'Pushcarts',
        width: '8%',
        render: (o) => o.nPushFiction + o.nPushNonfiction + o.nPushPoetry || '-',
        filterElement: (
          <NumericFilterPopover
            min={pushcartsMin}
            max={pushcartsMax}
            onChange={handlePushcartsFilterChange}
            label="Pushcarts"
          />
        ),
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
    [
      availableStatuses,
      availableTypes,
      availableTimings,
      cycleOrgStatus,
      showStatuses,
      toggleStatus,
      selectAllStatuses,
      selectNoneStatuses,
      selectOnlyStatus,
      showTypes,
      toggleType,
      selectAllTypes,
      selectNoneTypes,
      selectOnlyType,
      showTimings,
      toggleTiming,
      selectAllTimings,
      selectNoneTimings,
      selectOnlyTiming,
      submissionsMin,
      submissionsMax,
      handleSubmissionsFilterChange,
      pushcartsMin,
      pushcartsMax,
      handlePushcartsFilterChange,
    ]
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
      title="Organizations"
      data={orgs}
      columns={columns}
      loading={loading}
      getRowKey={(o) => o.orgID}
      onRowClick={(o) => navigate(`/organizations/${o.orgID}`)}
      filterFn={filterFn}
      initialSearch={initialSearch}
      onSearchChange={SetOrgsFilter}
      viewName="organizations"
      initialSort={initialSort}
      valueGetter={getOrgValue}
      extraColumns={<Table.Th style={{ width: '10%' }}>Actions</Table.Th>}
      renderExtraCells={renderExtraCells}
    />
  );
}
