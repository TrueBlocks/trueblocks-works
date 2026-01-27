/**
 * Test fixtures for @trueblocks/ui
 *
 * Real data, no mocks. These are simple objects that exercise the hooks.
 */

export interface TestItem {
  id: number;
  name: string;
  status: string;
  count: number;
  isDeleted: boolean;
}

export const testItems: TestItem[] = [
  { id: 1, name: 'Alpha', status: 'active', count: 10, isDeleted: false },
  { id: 2, name: 'Beta', status: 'pending', count: 5, isDeleted: false },
  { id: 3, name: 'Gamma', status: 'active', count: 20, isDeleted: true },
  { id: 4, name: 'Delta', status: 'closed', count: 0, isDeleted: false },
  { id: 5, name: 'Epsilon', status: 'pending', count: 15, isDeleted: false },
];

export const emptyItems: TestItem[] = [];

export const singleItem: TestItem[] = [
  { id: 1, name: 'Solo', status: 'active', count: 1, isDeleted: false },
];

export const allDeletedItems: TestItem[] = [
  { id: 1, name: 'Gone1', status: 'active', count: 1, isDeleted: true },
  { id: 2, name: 'Gone2', status: 'active', count: 2, isDeleted: true },
];
