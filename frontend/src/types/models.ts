import type {
  WorkType,
  WorkStatus,
  Quality,
  DocType,
  OrgStatus,
  OrgType,
  Timing,
  SubmissionType,
  Accepts,
  Interest,
  ResponseType,
  NoteType,
  CollectionType,
} from './enums';

export interface Work {
  workID: number;
  title: string;
  type: WorkType;
  status: WorkStatus;
  quality: Quality;
  docType: DocType;
  path?: string;
  draft?: string;
  nWords?: number;
  courseName?: string;
  isBlog?: string;
  isPrinted?: string;
  isProsePoem?: string;
  isRevised?: string;
  mark?: string;
  accessDate?: string;
  createdAt?: string;
  modifiedAt?: string;
}

export interface WorkView extends Work {
  generatedPath: string;
  submissionCount: number;
  pendingCount: number;
  acceptedCount: number;
}

export interface Organization {
  orgID: number;
  name: string;
  otherName?: string;
  url?: string;
  otherUrl?: string;
  status: OrgStatus;
  type: OrgType;
  timing?: Timing;
  submissionTypes?: string;
  accepts?: Accepts;
  myInterest?: Interest;
  ranking?: number;
  source?: string;
  websiteMenu?: string;
  duotropeNum?: number;
  nPushFiction: number;
  nPushNonfiction: number;
  nPushPoetry: number;
  contestEnds?: string;
  contestFee?: string;
  contestPrize?: string;
  contestPrize2?: string;
  dateAdded?: string;
  dateModified?: string;
}

export interface OrganizationView extends Organization {
  submissionCount: number;
  acceptedCount: number;
}

export interface Submission {
  submissionID: number;
  workID: number;
  orgID: number;
  draft: string;
  submissionDate?: string;
  submissionType?: SubmissionType;
  queryDate?: string;
  responseDate?: string;
  responseType?: ResponseType;
  contestName?: string;
  cost?: number;
  userId?: string;
  password?: string;
  webAddress?: string;
  mark?: string;
  createdAt?: string;
  modifiedAt?: string;
}

export interface SubmissionView extends Submission {
  workTitle: string;
  orgName: string;
  isPending: boolean;
}

export interface Collection {
  collID: number;
  collectionName: string;
  isStatus?: string;
  type?: CollectionType;
  createdAt?: string;
  modifiedAt?: string;
}

export interface CollectionView extends Collection {
  workCount: number;
}

export interface CollectionDetail {
  id: number;
  collID: number;
  workID: number;
  collectionName: string;
}

export interface WorkNote {
  noteID: number;
  workID: number;
  type?: NoteType;
  note?: string;
  modifiedDate?: string;
  createdAt?: string;
  modifiedAt?: string;
}

export interface JournalNote {
  noteID: number;
  orgID: number;
  type?: NoteType;
  note?: string;
  modifiedDate?: string;
  createdAt?: string;
  modifiedAt?: string;
}

export interface SearchResult {
  type: 'work' | 'organization' | 'submission';
  id: number;
  title: string;
  snippet: string;
  rank: number;
}
