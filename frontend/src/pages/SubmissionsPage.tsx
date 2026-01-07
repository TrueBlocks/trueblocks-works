import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Badge, ActionIcon } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { Log, LogErr } from '@/utils';
import { matchesFilter, intersectFilter } from '@/utils/filterHelpers';
import {
  GetAllSubmissionViews,
  GetAppState,
  SetSubmissionsFilter,
  GetSubmissionsFilterOptions,
  SetSubmissionsTypeFilter,
  SetSubmissionsResponseFilter,
  SetSubmissionsStatusFilter,
} from '@wailsjs/go/main/App';
import { models } from '@wailsjs/go/models';
import { ResponseBadge, DataTable, Column, ColumnFilterPopover, TypeBadge } from '@/components';
import { ViewSort, useColumnFilter } from '@/hooks';
import dayjs from 'dayjs';

function getStatus(sub: models.SubmissionView): string {
  return !sub.responseDate && !sub.responseType ? 'Active' : 'Closed';
}

export function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<models.SubmissionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialSearch, setInitialSearch] = useState('');
  const [initialSort, setInitialSort] = useState<ViewSort | undefined>(undefined);
  const navigate = useNavigate();

  const [typeOptions, setTypeOptions] = useState<string[]>([]);
  const [responseOptions, setResponseOptions] = useState<string[]>([]);
  const statusOptions = useMemo(() => ['Active', 'Closed'], []);

  const typeFilter = useColumnFilter(typeOptions, SetSubmissionsTypeFilter);
  const responseFilter = useColumnFilter(responseOptions, SetSubmissionsResponseFilter);
  const statusFilter = useColumnFilter(statusOptions, SetSubmissionsStatusFilter);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    Promise.all([GetAllSubmissionViews(), GetAppState(), GetSubmissionsFilterOptions()])
      .then(([data, appState, filterOpts]) => {
        Log('Submissions loaded:', data?.length || 0);
        setSubmissions(data || []);

        // Set filter options
        setTypeOptions(filterOpts.types || []);
        setResponseOptions(filterOpts.responses || []);

        // Restore search
        if (appState?.submissionsFilter) {
          setInitialSearch(appState.submissionsFilter);
        }

        // Restore sort
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

        typeFilter.initialize(
          new Set(intersectFilter(appState?.submissionsTypeFilter, filterOpts.types || []))
        );
        responseFilter.initialize(
          new Set(intersectFilter(appState?.submissionsResponseFilter, filterOpts.responses || []))
        );
        statusFilter.initialize(
          new Set(intersectFilter(appState?.submissionsStatusFilter, ['Active', 'Closed']))
        );
      })
      .catch((err) => LogErr('Failed to load submissions:', err))
      .finally(() => setLoading(false));
  }, [typeFilter, responseFilter, statusFilter]);

  const filterFn = useCallback(
    (sub: models.SubmissionView, search: string) => {
      const matchesSearch =
        sub.titleOfWork.toLowerCase().includes(search.toLowerCase()) ||
        sub.journalName.toLowerCase().includes(search.toLowerCase()) ||
        (sub.draft?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
        (sub.contestName?.toLowerCase().includes(search.toLowerCase()) ?? false);

      const status = getStatus(sub);

      return (
        matchesSearch &&
        matchesFilter(typeFilter.selected, sub.submissionType || '') &&
        matchesFilter(responseFilter.selected, sub.responseType || '') &&
        matchesFilter(statusFilter.selected, status)
      );
    },
    [typeFilter.selected, responseFilter.selected, statusFilter.selected]
  );

  const columns: Column<models.SubmissionView>[] = useMemo(
    () => [
      {
        key: 'titleOfWork',
        label: 'Work',
        width: '20%',
        render: (s) => s.titleOfWork || '-',
      },
      {
        key: 'journalName',
        label: 'Organization',
        width: '20%',
        render: (s) => s.journalName || '-',
      },
      {
        key: 'submissionType',
        label: 'Type',
        width: '12%',
        render: (s) => <TypeBadge value={s.submissionType} />,
        filterElement: (
          <ColumnFilterPopover
            options={typeOptions}
            selected={typeFilter.selected}
            onChange={typeFilter.toggle}
            onSelectAll={typeFilter.selectAll}
            onSelectNone={typeFilter.selectNone}
            onSelectOnly={typeFilter.selectOnly}
            label="Type"
          />
        ),
      },
      {
        key: 'responseType',
        label: 'Response',
        width: '12%',
        render: (s) => <ResponseBadge response={s.responseType} />,
        filterElement: (
          <ColumnFilterPopover
            options={responseOptions}
            selected={responseFilter.selected}
            onChange={responseFilter.toggle}
            onSelectAll={responseFilter.selectAll}
            onSelectNone={responseFilter.selectNone}
            onSelectOnly={responseFilter.selectOnly}
            label="Response"
          />
        ),
      },
      {
        key: 'status',
        label: 'Status',
        width: '10%',
        render: (s) => {
          const status = getStatus(s);
          return status === 'Active' ? (
            <Badge color="green" variant="light">
              Active
            </Badge>
          ) : (
            <Badge color="gray" variant="light">
              Closed
            </Badge>
          );
        },
        filterElement: (
          <ColumnFilterPopover
            options={statusOptions}
            selected={statusFilter.selected}
            onChange={statusFilter.toggle}
            onSelectAll={statusFilter.selectAll}
            onSelectNone={statusFilter.selectNone}
            onSelectOnly={statusFilter.selectOnly}
            label="Status"
          />
        ),
      },
      {
        key: 'submissionDate',
        label: 'Submitted',
        width: '12%',
        render: (s) => (s.submissionDate ? dayjs(s.submissionDate).format('MMM D, YYYY') : '-'),
      },
    ],
    [typeOptions, typeFilter, responseOptions, responseFilter, statusOptions, statusFilter]
  );

  return (
    <DataTable<models.SubmissionView>
      title="Submissions"
      data={submissions}
      columns={columns}
      loading={loading}
      getRowKey={(s) => s.submissionID}
      onRowClick={(s) => navigate(`/submissions/${s.submissionID}`)}
      filterFn={filterFn}
      initialSearch={initialSearch}
      onSearchChange={SetSubmissionsFilter}
      viewName="submissions"
      initialSort={initialSort}
      headerActions={
        <ActionIcon variant="filled" size="lg">
          <IconPlus size={18} />
        </ActionIcon>
      }
    />
  );
}
