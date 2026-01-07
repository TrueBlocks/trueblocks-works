import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Stack, Grid, Loader, Flex, Text, Group, Paper, ActionIcon, Table } from '@mantine/core';
import { IconFolder, IconArrowLeft, IconX, IconPlus } from '@tabler/icons-react';
import { LogErr, matchesFilter } from '@/utils';
import { useNotes, useColumnFilter } from '@/hooks';
import {
  GetCollection,
  GetCollectionWorks,
  RemoveWorkFromCollection,
  SetLastCollectionID,
  UpdateCollection,
} from '@wailsjs/go/main/App';
import { models } from '@wailsjs/go/models';
import {
  NotesPortal,
  DataTable,
  EditableField,
  Column,
  CollectionFieldSelect,
  WorkPickerModal,
  ColumnFilterPopover,
  StatusBadge,
  QualityBadge,
  TypeBadge,
} from '@/components';

export function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<models.Collection | null>(null);
  const [works, setWorks] = useState<models.CollectionWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [workPickerOpen, setWorkPickerOpen] = useState(false);

  const collId = id ? parseInt(id, 10) : null;
  const {
    notes,
    handleAdd: handleAddNote,
    handleUpdate: handleUpdateNote,
    handleDelete: handleDeleteNote,
  } = useNotes('collection', collId);

  const availableYears = useMemo(
    () => [...new Set(works.map((w) => w.year).filter(Boolean))].sort() as string[],
    [works]
  );
  const availableTypes = useMemo(
    () => [...new Set(works.map((w) => w.type).filter(Boolean))].sort() as string[],
    [works]
  );
  const availableStatuses = useMemo(
    () => [...new Set(works.map((w) => w.status).filter(Boolean))].sort() as string[],
    [works]
  );
  const availableQualities = useMemo(
    () => [...new Set(works.map((w) => w.quality).filter(Boolean))].sort() as string[],
    [works]
  );

  const yearFilter = useColumnFilter(availableYears);
  const typeFilter = useColumnFilter(availableTypes);
  const statusFilter = useColumnFilter(availableStatuses);
  const qualityFilter = useColumnFilter(availableQualities);

  const loadData = useCallback(async () => {
    if (!collId) return;
    setLoading(true);
    try {
      const [collData, worksData] = await Promise.all([
        GetCollection(collId),
        GetCollectionWorks(collId),
      ]);
      setCollection(collData);
      setWorks(worksData || []);
      SetLastCollectionID(collId);
    } catch (err) {
      LogErr('Failed to load collection data:', err);
    } finally {
      setLoading(false);
    }
  }, [collId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRemoveWork = useCallback(
    async (workId: number) => {
      if (!collId) return;
      await RemoveWorkFromCollection(collId, workId);
      setWorks((prev) => prev.filter((w) => w.workID !== workId));
    },
    [collId]
  );

  const handleNameChange = useCallback(
    async (newName: string) => {
      if (!collection) return;
      const updated = { ...collection, collectionName: newName } as models.Collection;
      setCollection(updated);
      await UpdateCollection(updated);
    },
    [collection]
  );

  const columns: Column<models.CollectionWork>[] = useMemo(
    () => [
      {
        key: 'workID',
        label: 'ID',
        width: '60px',
        render: (work) => <Text size="sm">{work.workID}</Text>,
      },
      {
        key: 'title',
        label: 'Title',
        render: (work) => (
          <Text size="sm" truncate>
            {work.title}
          </Text>
        ),
      },
      {
        key: 'year',
        label: 'Year',
        width: '80px',
        render: (work) => <Text size="sm">{work.year || '-'}</Text>,
        filterElement: (
          <ColumnFilterPopover
            options={availableYears}
            selected={yearFilter.selected}
            onChange={yearFilter.toggle}
            onSelectAll={yearFilter.selectAll}
            onSelectNone={yearFilter.selectNone}
            onSelectOnly={yearFilter.selectOnly}
            label="Year"
          />
        ),
      },
      {
        key: 'type',
        label: 'Type',
        width: '100px',
        render: (work) => <TypeBadge value={work.type} />,
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
        key: 'status',
        label: 'Status',
        width: '100px',
        render: (work) => <StatusBadge status={work.status} />,
        filterElement: (
          <ColumnFilterPopover
            options={availableStatuses}
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
        key: 'quality',
        label: 'Quality',
        width: '100px',
        render: (work) => <QualityBadge quality={work.quality} />,
        filterElement: (
          <ColumnFilterPopover
            options={availableQualities}
            selected={qualityFilter.selected}
            onChange={qualityFilter.toggle}
            onSelectAll={qualityFilter.selectAll}
            onSelectNone={qualityFilter.selectNone}
            onSelectOnly={qualityFilter.selectOnly}
            label="Quality"
          />
        ),
      },
    ],
    [
      availableYears,
      yearFilter,
      availableTypes,
      typeFilter,
      availableStatuses,
      statusFilter,
      availableQualities,
      qualityFilter,
    ]
  );

  const filterFn = useCallback(
    (work: models.CollectionWork, search: string) => {
      if (!matchesFilter(yearFilter.selected, work.year)) return false;
      if (!matchesFilter(typeFilter.selected, work.type)) return false;
      if (!matchesFilter(statusFilter.selected, work.status)) return false;
      if (!matchesFilter(qualityFilter.selected, work.quality)) return false;

      const s = search.toLowerCase();
      return (
        work.title.toLowerCase().includes(s) ||
        (work.type?.toLowerCase().includes(s) ?? false) ||
        (work.year?.toLowerCase().includes(s) ?? false) ||
        String(work.workID).includes(s)
      );
    },
    [yearFilter.selected, typeFilter.selected, statusFilter.selected, qualityFilter.selected]
  );

  const valueGetter = useCallback((item: models.CollectionWork, column: string) => {
    switch (column) {
      case 'workID':
        return item.workID;
      default:
        return (item as unknown as Record<string, unknown>)[column];
    }
  }, []);

  if (loading) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Loader />
      </Flex>
    );
  }

  if (!collection) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Text c="dimmed">Collection not found</Text>
      </Flex>
    );
  }

  return (
    <Stack gap="lg">
      <Paper p="md" withBorder>
        <Group gap="md">
          <ActionIcon variant="subtle" size="lg" onClick={() => navigate('/collections')}>
            <IconArrowLeft size={20} />
          </ActionIcon>
          <IconFolder size={32} />
          <div style={{ flex: 1 }}>
            <EditableField value={collection.collectionName} onChange={handleNameChange} />
            <Group gap="xs" mt={4}>
              <CollectionFieldSelect
                collection={collection}
                field="type"
                width={100}
                onUpdate={(updated) => setCollection(updated)}
              />
              <Text size="sm" c="dimmed">
                {works.length} work{works.length !== 1 ? 's' : ''}
              </Text>
            </Group>
          </div>
        </Group>
      </Paper>

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <DataTable
            title="Works in Collection"
            data={works}
            columns={columns}
            getRowKey={(work) => work.workID}
            onRowClick={(work) => navigate(`/works/${work.workID}`)}
            filterFn={filterFn}
            viewName="collectionDetailWorks"
            pageSize={15}
            initialSort={{
              primary: { column: 'position', direction: 'asc' },
              secondary: { column: '', direction: '' },
            }}
            valueGetter={valueGetter}
            extraColumns={<Table.Th style={{ width: '50px' }} />}
            renderExtraCells={(work) => (
              <Table.Td>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveWork(work.workID);
                  }}
                >
                  <IconX size={14} />
                </ActionIcon>
              </Table.Td>
            )}
            headerActions={
              <ActionIcon variant="light" onClick={() => setWorkPickerOpen(true)}>
                <IconPlus size={16} />
              </ActionIcon>
            }
          />
          <WorkPickerModal
            opened={workPickerOpen}
            onClose={() => setWorkPickerOpen(false)}
            collectionID={collId || 0}
            onUpdate={loadData}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <NotesPortal
            notes={notes}
            onAdd={handleAddNote}
            onUpdate={handleUpdateNote}
            onDelete={handleDeleteNote}
          />
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
