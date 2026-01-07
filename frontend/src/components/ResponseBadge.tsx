import { Badge } from '@mantine/core';
import { responseColors } from '@/types';
import { hashColor } from '@/utils';

interface ResponseBadgeProps {
  response: string | undefined;
}

export function ResponseBadge({ response }: ResponseBadgeProps) {
  const displayValue = response || 'Pending';
  const color =
    responseColors[displayValue as keyof typeof responseColors] || hashColor(displayValue);
  return (
    <Badge color={color} variant="light">
      {displayValue}
    </Badge>
  );
}
