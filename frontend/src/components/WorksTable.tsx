import { Table, Text } from '@mantine/core';
import { models } from '@models';
import { StatusBadge, QualityBadge } from '@/components';

interface WorksTableProps {
  works: models.Work[];
  onRowClick?: (work: models.Work) => void;
  onDoubleClick?: (work: models.Work) => void;
  selectedId?: number | null;
}

export function WorksTable({ works, onRowClick, onDoubleClick, selectedId }: WorksTableProps) {
  if (works.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No works in this collection
      </Text>
    );
  }

  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Title</Table.Th>
          <Table.Th>Type</Table.Th>
          <Table.Th>Status</Table.Th>
          <Table.Th>Quality</Table.Th>
          <Table.Th>Words</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {works.map((work) => (
          <Table.Tr
            key={work.workID}
            style={{
              cursor: onRowClick ? 'pointer' : 'default',
              backgroundColor:
                selectedId === work.workID ? 'var(--mantine-color-blue-light)' : undefined,
            }}
            onClick={() => onRowClick?.(work)}
            onDoubleClick={() => onDoubleClick?.(work)}
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
  );
}
