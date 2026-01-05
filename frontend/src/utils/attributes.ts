export function hasAttribute(attributes: string, attr: string): boolean {
  if (!attributes) return false;
  return attributes.split(',').includes(attr);
}

export function addAttribute(attributes: string, attr: string): string {
  if (hasAttribute(attributes, attr)) return attributes;
  if (!attributes) return attr;
  return `${attributes},${attr}`;
}

export function removeAttribute(attributes: string, attr: string): string {
  if (!attributes) return '';
  return attributes
    .split(',')
    .filter((a) => a !== attr)
    .join(',');
}

export function getAttributes(attributes: string): string[] {
  if (!attributes) return [];
  return attributes.split(',');
}

export type WorkAttribute = 'blog' | 'printed' | 'prose_poem' | 'revised';

export const WORK_ATTRIBUTES: WorkAttribute[] = ['blog', 'printed', 'prose_poem', 'revised'];
