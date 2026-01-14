import { Badge } from '@mantine/core';
import { Quality } from '../types';

// Quality color mapping from FileMaker (text colors)
const qualityColors: Record<Quality, { bg: string; color: string }> = {
  Best: { bg: '#1B5E20', color: '#FFFFFF' },
  Better: { bg: '#388E3C', color: '#FFFFFF' },
  Good: { bg: '#66BB6A', color: '#1B5E20' },
  Okay: { bg: '#E0E0E0', color: '#616161' },
  Poor: { bg: '#B0BEC5', color: '#37474F' },
  Bad: { bg: '#FFCDD2', color: '#B71C1C' },
  Worst: { bg: '#EF5350', color: '#FFFFFF' },
  Unknown: { bg: '#F5F5F5', color: '#9E9E9E' },
};

// Quality mark prefixes (for file naming)
export const qualityMarks: Record<Quality, string> = {
  Best: 'aa',
  Better: 'ab',
  Good: 'b',
  Okay: 'c',
  Poor: 'd',
  Bad: 'e',
  Worst: 'f',
  Unknown: 'z',
};

interface QualityBadgeProps {
  quality: Quality;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export function QualityBadge({ quality, size = 'sm' }: QualityBadgeProps) {
  const colors = qualityColors[quality] || { bg: '#E0E0E0', color: '#424242' };

  return (
    <Badge
      size={size}
      style={{
        backgroundColor: colors.bg,
        color: colors.color,
        fontWeight: 600,
      }}
    >
      {quality}
    </Badge>
  );
}

export default QualityBadge;
