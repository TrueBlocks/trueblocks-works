import { Badge } from '@mantine/core';
import { hashColor } from '@trueblocks/ui';
import { qualityColors } from '@/types';

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
