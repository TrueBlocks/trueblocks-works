import { Badge } from '@mantine/core';
import { responseColors } from '@/types';

interface ResponseBadgeProps {
  response: string | undefined;
}

export function ResponseBadge({ response }: ResponseBadgeProps) {
  const displayValue = response || 'Pending';
  const color = responseColors[displayValue as keyof typeof responseColors] || 'gray';
  return (
    <Badge color={color} variant="dot">
      {displayValue}
    </Badge>
  );
}
