import { Badge } from '@mantine/core';
import { hashColor } from '@trueblocks/ui';
import { responseColors } from '@/types';

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
