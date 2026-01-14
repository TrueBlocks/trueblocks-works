import { Badge } from '@mantine/core';
import { qualityColors } from '@/types';
import { hashColor } from '@/utils';

interface QualityBadgeProps {
  quality: string;
}

export function QualityBadge({ quality }: QualityBadgeProps) {
  const color = qualityColors[quality as keyof typeof qualityColors] || hashColor(quality);
  return (
    <Badge color={color} variant="filled">
      {quality || 'Unrated'}
    </Badge>
  );
}
