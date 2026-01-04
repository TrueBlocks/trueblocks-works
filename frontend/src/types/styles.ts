import type { Quality, WorkStatus, OrgStatus, ResponseType } from './enums';

export const qualityColors: Record<Quality, string> = {
  Excellent: 'green',
  Good: 'blue',
  Fair: 'yellow',
  Poor: 'red',
  '': 'gray',
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
