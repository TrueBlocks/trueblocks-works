import { Badge } from '@mantine/core';
import { qualityColors } from '@/types';

interface QualityBadgeProps {
  quality: string;
}

export function QualityBadge({ quality }: QualityBadgeProps) {
  const color = qualityColors[quality as keyof typeof qualityColors] || 'gray';
  return (
    <Badge color={color} variant="filled">
      {quality || 'Unrated'}
    </Badge>
  );
}
