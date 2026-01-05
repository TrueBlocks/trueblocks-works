import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { ResponseBadge, DataTable, Column, ColumnFilterPopover } from '@/components';
import { ViewSort } from '@/hooks';
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

  // Filter options from DB
  const [typeOptions, setTypeOptions] = useState<string[]>([]);
  const [responseOptions, setResponseOptions] = useState<string[]>([]);
  const statusOptions = useMemo(() => ['Active', 'Closed'], []);

  // Selected filters
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedResponses, setSelectedResponses] = useState<Set<string>>(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());

  useEffect(() => {
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

        // Restore filters (intersect with available options)
        const types = intersectFilter(appState?.submissionsTypeFilter, filterOpts.types || []);
        setSelectedTypes(new Set(types));

        const responses = intersectFilter(
          appState?.submissionsResponseFilter,
          filterOpts.responses || []
        );
        setSelectedResponses(new Set(responses));

        const statuses = intersectFilter(appState?.submissionsStatusFilter, ['Active', 'Closed']);
        setSelectedStatuses(new Set(statuses));
      })
      .catch((err) => LogErr('Failed to load submissions:', err))
      .finally(() => setLoading(false));
  }, []);

  // Filter handlers
  const handleTypeChange = useCallback((value: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      SetSubmissionsTypeFilter([...next]);
      return next;
    });
  }, []);

  const handleResponseChange = useCallback((value: string) => {
    setSelectedResponses((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      SetSubmissionsResponseFilter([...next]);
      return next;
    });
  }, []);

  const handleStatusChange = useCallback((value: string) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      SetSubmissionsStatusFilter([...next]);
      return next;
    });
  }, []);

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
        matchesFilter(selectedTypes, sub.submissionType || '') &&
        matchesFilter(selectedResponses, sub.responseType || '') &&
        matchesFilter(selectedStatuses, status)
      );
    },
    [selectedTypes, selectedResponses, selectedStatuses]
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
        render: (s) => s.submissionType || '-',
        filterElement: (
          <ColumnFilterPopover
            options={typeOptions}
            selected={selectedTypes}
            onChange={handleTypeChange}
            onSelectAll={() => {
              setSelectedTypes(new Set(typeOptions));
              SetSubmissionsTypeFilter([...typeOptions]);
            }}
            onSelectNone={() => {
              setSelectedTypes(new Set());
              SetSubmissionsTypeFilter([]);
            }}
            onSelectOnly={(value) => {
              setSelectedTypes(new Set([value]));
              SetSubmissionsTypeFilter([value]);
            }}
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
            selected={selectedResponses}
            onChange={handleResponseChange}
            onSelectAll={() => {
              setSelectedResponses(new Set(responseOptions));
              SetSubmissionsResponseFilter([...responseOptions]);
            }}
            onSelectNone={() => {
              setSelectedResponses(new Set());
              SetSubmissionsResponseFilter([]);
            }}
            onSelectOnly={(value) => {
              setSelectedResponses(new Set([value]));
              SetSubmissionsResponseFilter([value]);
            }}
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
            <Badge color="green" variant="light" size="sm">
              Active
            </Badge>
          ) : (
            <Badge color="gray" variant="light" size="sm">
              Closed
            </Badge>
          );
        },
        filterElement: (
          <ColumnFilterPopover
            options={statusOptions}
            selected={selectedStatuses}
            onChange={handleStatusChange}
            onSelectAll={() => {
              setSelectedStatuses(new Set(statusOptions));
              SetSubmissionsStatusFilter([...statusOptions]);
            }}
            onSelectNone={() => {
              setSelectedStatuses(new Set());
              SetSubmissionsStatusFilter([]);
            }}
            onSelectOnly={(value) => {
              setSelectedStatuses(new Set([value]));
              SetSubmissionsStatusFilter([value]);
            }}
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
    [
      typeOptions,
      selectedTypes,
      handleTypeChange,
      responseOptions,
      selectedResponses,
      handleResponseChange,
      statusOptions,
      selectedStatuses,
      handleStatusChange,
    ]
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
