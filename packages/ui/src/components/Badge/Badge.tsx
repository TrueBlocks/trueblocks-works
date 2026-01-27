import { Badge as MantineBadge, BadgeProps as MantineBadgeProps } from '@mantine/core';
import { ReactNode } from 'react';

export interface StatusBadgeProps extends Omit<MantineBadgeProps, 'color'> {
  status: string;
  colorMap?: Record<string, string>;
  children?: ReactNode;
}

const defaultColorMap: Record<string, string> = {
  active: 'green',
  inactive: 'gray',
  pending: 'yellow',
  error: 'red',
  success: 'green',
  warning: 'orange',
  info: 'blue',
};

export function StatusBadge({ status, colorMap, children, ...props }: StatusBadgeProps) {
  const colors = { ...defaultColorMap, ...colorMap };
  const color = colors[status.toLowerCase()] ?? 'gray';

  return (
    <MantineBadge color={color} variant="light" {...props}>
      {children ?? status}
    </MantineBadge>
  );
}
