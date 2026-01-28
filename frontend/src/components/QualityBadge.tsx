import { ColorBadge } from '@trueblocks/ui';
import { qualityColors } from '@/types';

interface QualityBadgeProps {
  quality: string;
}

export function QualityBadge({ quality }: QualityBadgeProps) {
  return (
    <ColorBadge value={quality} colorMap={qualityColors} fallback="Unrated" variant="filled" />
  );
}
