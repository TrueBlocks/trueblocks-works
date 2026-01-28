import { Badge, BadgeProps } from '@mantine/core';
import { hashColor } from '../utils';

export interface ColorBadgeProps extends Omit<BadgeProps, 'color'> {
  value: string | undefined;
  colorMap?: Record<string, string>;
  fallback?: string;
}

export function ColorBadge({
  value,
  colorMap,
  fallback = 'Unknown',
  variant = 'light',
  ...rest
}: ColorBadgeProps) {
  const displayValue = value || fallback;
  const color = colorMap?.[displayValue] ?? hashColor(displayValue);

  return (
    <Badge color={color} variant={variant} {...rest}>
      {displayValue}
    </Badge>
  );
}
