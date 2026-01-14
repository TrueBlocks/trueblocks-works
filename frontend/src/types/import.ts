export interface InvalidFile {
  filename: string;
  errors: string[];
}

export type ImportStatus = 'complete' | 'needs_type' | 'cancelled';

export interface ImportResult {
  status: ImportStatus;
  imported: number;
  updated: number;
  invalid: InvalidFile[];
  collectionID: number;
  unknownType?: string;
  currentFile?: string;
}
