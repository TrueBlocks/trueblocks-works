import { Badge } from '@mantine/core';
import { workStatusColors } from '@/types';

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const color = workStatusColors[status as keyof typeof workStatusColors] || 'gray';
  return (
    <Badge color={color} variant="light">
      {status || 'Unknown'}
    </Badge>
  );
}
