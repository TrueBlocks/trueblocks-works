import { Badge } from '@mantine/core';
import { orgStatusColors } from '@/types';

interface OrgStatusBadgeProps {
  status: string;
}

export function OrgStatusBadge({ status }: OrgStatusBadgeProps) {
  const color = orgStatusColors[status as keyof typeof orgStatusColors] || 'gray';
  return (
    <Badge color={color} variant="light">
      {status || 'Unknown'}
    </Badge>
  );
}
