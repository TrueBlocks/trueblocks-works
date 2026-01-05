import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { LogErr, matchesFilter } from '@/utils';
import { GetCollections, GetAppState, SetCollectionsFilter } from '@wailsjs/go/main/App';
import { models } from '@wailsjs/go/models';
import { DataTable, Column, ColumnFilterPopover } from '@/components';
import { useColumnFilter } from '@/hooks';
import { useNavigate } from 'react-router';

export function CollectionsPage() {
  const [collections, setCollections] = useState<models.Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialSearch, setInitialSearch] = useState('');
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const navigate = useNavigate();

  const typeFilter = useColumnFilter(availableTypes);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    Promise.all([GetCollections(), GetAppState()])
      .then(([colls, appState]) => {
        const data = colls || [];
        setCollections(data);

        const types = [...new Set(data.map((c) => c.type).filter(Boolean))] as string[];
        setAvailableTypes(types);

        if (appState?.collectionsFilter) {
          setInitialSearch(appState.collectionsFilter);
        }

        typeFilter.initialize(new Set(types));
      })
      .catch((err) => LogErr('Failed to load collections:', err))
      .finally(() => setLoading(false));
  }, [typeFilter]);

  const filterFn = useCallback(
    (coll: models.Collection, search: string) => {
      const matchesSearch = coll.collectionName.toLowerCase().includes(search.toLowerCase());
      return matchesSearch && matchesFilter(typeFilter.selected, coll.type);
    },
    [typeFilter.selected]
  );

  const columns: Column<models.Collection>[] = useMemo(
    () => [
      { key: 'collID', label: 'ID', width: '8%', render: (c) => c.collID },
      { key: 'collectionName', label: 'Name', width: '40%', render: (c) => c.collectionName },
      {
        key: 'type',
        label: 'Type',
        width: '15%',
        render: (c) => c.type || '-',
        filterElement: (
          <ColumnFilterPopover
            options={availableTypes}
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
        key: 'isStatus',
        label: 'Status Collection',
        width: '15%',
        render: (c) => (c.isStatus ? 'Yes' : 'No'),
      },
      {
        key: 'createdAt',
        label: 'Created',
        width: '15%',
        render: (c) => (c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '-'),
      },
    ],
    [availableTypes, typeFilter]
  );

  return (
    <DataTable<models.Collection>
      title="Collections"
      data={collections}
      columns={columns}
      loading={loading}
      getRowKey={(c) => c.collID}
      onRowClick={(c) => navigate(`/collections/${c.collID}`)}
      filterFn={filterFn}
      initialSearch={initialSearch}
      onSearchChange={SetCollectionsFilter}
      viewName="collections"
    />
  );
}
