import { Badge } from '@mantine/core';
import { Status } from '../types';

// Status color mapping from FileMaker
const statusColors: Record<Status, { bg: string; color: string }> = {
  Focus: { bg: '#C8E6C9', color: '#1B5E20' },
  Active: { bg: '#A5D6A7', color: '#1B5E20' },
  Working: { bg: '#BBDEFB', color: '#0D47A1' },
  Resting: { bg: '#E1BEE7', color: '#4A148C' },
  Waiting: { bg: '#FFE0B2', color: '#E65100' },
  Gestating: { bg: '#FFF9C4', color: '#F57F17' },
  Sleeping: { bg: '#EEEEEE', color: '#616161' },
  Dying: { bg: '#FFCDD2', color: '#B71C1C' },
  Dead: { bg: '#CFD8DC', color: '#37474F' },
  Out: { bg: '#B3E5FC', color: '#01579B' },
  Done: { bg: '#388E3C', color: '#FFFFFF' },
  Published: { bg: '#388E3C', color: '#FFFFFF' },
  Sound: { bg: '#C5E1A5', color: '#33691E' },
};

interface StatusBadgeProps {
  status: Status;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const colors = statusColors[status] || { bg: '#E0E0E0', color: '#424242' };

  return (
    <Badge
      size={size}
      style={{
        backgroundColor: colors.bg,
        color: colors.color,
        fontWeight: 500,
      }}
    >
      {status}
    </Badge>
  );
}

export default StatusBadge;
