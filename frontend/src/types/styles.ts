import type { Quality, WorkStatus, OrgStatus, ResponseType } from './enums';

// Colors ordered by quality: best (green) → worst (red)
export const qualityColors: Record<Quality, string> = {
  Best: 'green',
  Better: 'teal',
  Good: 'blue',
  Okay: 'cyan',
  Poor: 'yellow',
  Bad: 'orange',
  Worst: 'red',
  Unknown: 'gray',
  '': 'gray',
};

// Sort order for Quality column - matches internal/fileops/paths.go GetQualityMark()
// aa=Best, a=Better, b=Good, c=Okay, d=Poor, e=Bad, f=Worst, z=Unknown
export const qualitySortOrder: Record<Quality, number> = {
  Best: 1,
  Better: 2,
  Good: 3,
  Okay: 4,
  Poor: 5,
  Bad: 6,
  Worst: 7,
  Unknown: 8,
  '': 9,
};

export const workStatusColors: Record<WorkStatus, string> = {
  Active: 'blue',
  Complete: 'green',
  Dead: 'red',
  Retired: 'gray',
  '': 'gray',
};

export const orgStatusColors: Record<OrgStatus, string> = {
  Open: 'green',
  Boring: 'yellow',
  Defunct: 'red',
  '': 'gray',
};

export const responseColors: Record<ResponseType, string> = {
  Accepted: 'green',
  Rejected: 'red',
  Withdrawn: 'gray',
  'No Response': 'orange',
  Pending: 'blue',
  '': 'gray',
};
