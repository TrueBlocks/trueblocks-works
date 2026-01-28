const HASH_COLORS = [
  'blue',
  'cyan',
  'teal',
  'green',
  'lime',
  'yellow',
  'orange',
  'red',
  'pink',
  'grape',
  'violet',
  'indigo',
] as const;

export function hashColor(value: string | null | undefined, fallback = 'gray'): string {
  if (!value) return fallback;
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash = hash & hash;
  }
  return HASH_COLORS[Math.abs(hash) % HASH_COLORS.length] as string;
}
