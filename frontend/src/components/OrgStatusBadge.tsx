import { Badge } from '@mantine/core';
import { orgStatusColors } from '@/types';
import { hashColor } from '@/utils';

interface OrgStatusBadgeProps {
  status: string;
}

export function OrgStatusBadge({ status }: OrgStatusBadgeProps) {
  const color = orgStatusColors[status as keyof typeof orgStatusColors] || hashColor(status);
  return (
    <Badge color={color} variant="light">
      {status || 'Unknown'}
    </Badge>
  );
}
