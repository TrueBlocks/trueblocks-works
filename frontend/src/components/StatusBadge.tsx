import { ColorBadge } from '@trueblocks/ui';
import { workStatusColors } from '@/types';

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return <ColorBadge value={status} colorMap={workStatusColors} fallback="Unknown" />;
}
