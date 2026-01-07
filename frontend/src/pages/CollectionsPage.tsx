import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { LogErr } from '@/utils';
import { GetCollections } from '@wailsjs/go/main/App';
import { models } from '@wailsjs/go/models';
import { DataTable, Column, TypeBadge } from '@/components';
import { useNavigate } from 'react-router';

export function CollectionsPage() {
  const [collections, setCollections] = useState<models.CollectionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const navigate = useNavigate();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    GetCollections()
      .then((colls) => {
        const data = colls || [];
        setCollections(data);
        const types = [...new Set(data.map((c) => c.type).filter(Boolean))] as string[];
        setAvailableTypes(types);
      })
      .catch((err) => LogErr('Failed to load collections:', err))
      .finally(() => setLoading(false));
  }, []);

  const searchFn = useCallback((coll: models.CollectionView, search: string) => {
    return coll.collectionName.toLowerCase().includes(search.toLowerCase());
  }, []);

  const columns: Column<models.CollectionView>[] = useMemo(
    () => [
      { key: 'collID', label: 'ID', width: '8%', render: (c) => c.collID },
      { key: 'collectionName', label: 'Name', width: '45%', render: (c) => c.collectionName },
      {
        key: 'type',
        label: 'Type',
        width: '15%',
        render: (c) => <TypeBadge value={c.type} />,
        filterOptions: availableTypes,
      },
      {
        key: 'nItems',
        label: 'Works',
        width: '12%',
        render: (c) => c.nItems,
      },
      {
        key: 'modifiedAt',
        label: 'Last Modified',
        width: '20%',
        render: (c) => (c.modifiedAt ? new Date(c.modifiedAt + 'Z').toLocaleDateString() : '-'),
      },
    ],
    [availableTypes]
  );

  return (
    <DataTable<models.CollectionView>
      tableName="collections"
      title="Collections"
      data={collections}
      columns={columns}
      loading={loading}
      getRowKey={(c) => c.collID}
      onRowClick={(c) => navigate(`/collections/${c.collID}`)}
      searchFn={searchFn}
    />
  );
}
