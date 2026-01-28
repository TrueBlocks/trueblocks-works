import { ColorBadge } from '@trueblocks/ui';
import { orgStatusColors } from '@/types';

interface OrgStatusBadgeProps {
  status: string;
}

export function OrgStatusBadge({ status }: OrgStatusBadgeProps) {
  return <ColorBadge value={status} colorMap={orgStatusColors} fallback="Unknown" />;
}
