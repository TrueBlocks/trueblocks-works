import { Badge } from '@mantine/core';
import { workStatusColors } from '@/types';
import { hashColor } from '@/utils';

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const color = workStatusColors[status as keyof typeof workStatusColors] || hashColor(status);
  return (
    <Badge color={color} variant="light">
      {status || 'Unknown'}
    </Badge>
  );
}
