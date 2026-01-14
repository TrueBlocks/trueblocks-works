import { Badge } from '@mantine/core';
import { ResponseType } from '../types';

const responseColors: Record<ResponseType, { bg: string; color: string }> = {
  Pending: { bg: '#FFF9C4', color: '#F57F17' },
  Accepted: { bg: '#C8E6C9', color: '#1B5E20' },
  Declined: { bg: '#FFCDD2', color: '#B71C1C' },
  Withdrawn: { bg: '#E0E0E0', color: '#616161' },
  Email: { bg: '#BBDEFB', color: '#0D47A1' },
  'No Response': { bg: '#CFD8DC', color: '#37474F' },
};

interface ResponseBadgeProps {
  response: ResponseType;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export function ResponseBadge({ response, size = 'sm' }: ResponseBadgeProps) {
  const colors = responseColors[response] || { bg: '#E0E0E0', color: '#424242' };

  return (
    <Badge
      size={size}
      style={{
        backgroundColor: colors.bg,
        color: colors.color,
        fontWeight: 500,
      }}
    >
      {response}
    </Badge>
  );
}

export default ResponseBadge;
