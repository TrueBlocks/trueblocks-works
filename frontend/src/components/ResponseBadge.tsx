import { ColorBadge } from '@trueblocks/ui';
import { responseColors } from '@/types';

interface ResponseBadgeProps {
  response: string | undefined;
}

export function ResponseBadge({ response }: ResponseBadgeProps) {
  return <ColorBadge value={response} colorMap={responseColors} fallback="Pending" />;
}
