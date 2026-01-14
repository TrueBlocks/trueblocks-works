// TypeScript types for the Submissions Tracker

export type StatusType =
  | 'Focus'
  | 'Active'
  | 'Working'
  | 'Resting'
  | 'Waiting'
  | 'Gestating'
  | 'Sleeping'
  | 'Dying'
  | 'Dead'
  | 'Done'
  | 'Published'
  | 'Out'
  | 'Sound';

// Alias for compatibility
export type Status = StatusType;

export type QualityType = 'Best' | 'Better' | 'Good' | 'Okay' | 'Poor' | 'Bad' | 'Worst' | 'Unknown';

// Alias for compatibility
export type Quality = QualityType;

export type WorkType =
  | 'Poem'
  | 'Story'
  | 'Essay'
  | 'Song'
  | 'Essay Idea'
  | 'Story Idea'
  | 'Poem Idea';

export type CollectionType = 'Active' | 'Process' | 'Book' | 'Dead' | 'Other';

export type ResponseType =
  | 'Pending'
  | 'Accepted'
  | 'Declined'
  | 'Withdrawn'
  | 'Email'
  | 'No Response';

export interface Work {
  workID: number;
  title: string;
  type: WorkType;
  status: StatusType;
  quality: QualityType;
  year: number;
  path: string;
  docType: string;
  nWords: string;
  isPrinted: boolean;
  isBlog: boolean;
  isRevised: boolean;
  isProsePoem: boolean;
  hasSound: boolean;
  accessDate: string;
}

export interface Collection {
  collectionID: string;
  collectionName: string;
  type: CollectionType;
  isStatus: boolean;
  statusList: string;
  nItems: number;
}

export interface Organization {
  orgID: number;
  name: string;
  otherName: string;
  type: string;
  status: string;
  myInterest: Quality;
  accepts: string;
  url: string;
  otherURL: string;
  submissionTypes: string;
  timing: string;
  ranking: number;
  nPushPoetry: number;
  nPushFiction: number;
  nPushNonFiction: number;
}

export interface Submission {
  submissionID: number;
  workID: number;
  orgID: number;
  submissionDate: string;
  queryDate: string;
  responseDate: string;
  responseType: ResponseType;
  submissionType: string;
  draft: string;
  contestName: string;
  cost: string;
  webAddress: string;
  userID: string;
  password: string;
}
