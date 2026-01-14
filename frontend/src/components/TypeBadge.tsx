import { Badge } from '@mantine/core';
import { hashColor } from '@/utils';

interface TypeBadgeProps {
  value: string | undefined | null;
  fallback?: string;
}

export function TypeBadge({ value, fallback = '-' }: TypeBadgeProps) {
  if (!value) {
    return <span>{fallback}</span>;
  }
  const color = hashColor(value);
  return (
    <Badge color={color} variant="light">
      {value}
    </Badge>
  );
}
