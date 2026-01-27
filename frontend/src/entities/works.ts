/**
 * Works Entity Contract
 *
 * Defines the configuration for the Works entity to use with @trueblocks/scaffold.
 * This is a parallel implementation - the existing WorksList and WorkDetail still work.
 * Once validated, the old components can be removed.
 */

import type { EntityContract, ColumnDef, FieldDef, DeleteConfirmation } from '@trueblocks/scaffold';
import { models, db } from '@models';
import {
  GetWorks,
  DeleteWork,
  UndeleteWork,
  DeleteWorkPermanent,
  GetWorkDeleteConfirmation,
} from '@app';

/**
 * Adapted Work type that conforms to EntityContract requirements.
 * Maps workID -> id.
 */
export interface WorkEntity {
  id: number;
  workID: number;
  title: string;
  type: string;
  status: string;
  quality: string;
  collectionList: string;
  nWords: number;
  isDeleted: boolean;
  nSubmissions: number;
  nNotes: number;
  generatedPath: string;
}

function toWorkEntity(work: models.WorkView): WorkEntity {
  return {
    id: work.workID,
    workID: work.workID,
    title: work.title,
    type: work.type,
    status: work.status,
    quality: work.quality,
    collectionList: work.collectionList ?? '',
    nWords: work.nWords ?? 0,
    isDeleted: work.isDeleted,
    nSubmissions: work.nSubmissions,
    nNotes: work.nNotes,
    generatedPath: work.generatedPath ?? '',
  };
}

function dbConfToScaffoldConf(conf: db.DeleteConfirmation): DeleteConfirmation {
  const consequences: string[] = [];
  if (conf.noteCount > 0) {
    consequences.push(`${conf.noteCount} note(s) will be deleted`);
  }
  if (conf.submissionCount > 0) {
    consequences.push(`${conf.submissionCount} submission(s) will be deleted`);
  }
  if (conf.collectionCount > 0) {
    consequences.push(`Will be removed from ${conf.collectionCount} collection(s)`);
  }
  if (conf.hasFile) {
    consequences.push(`File will be archived: ${conf.filePath}`);
  }

  return {
    title: `Delete ${conf.entityName}?`,
    message: `This will permanently delete "${conf.entityName}". This action cannot be undone.`,
    confirmLabel: 'Delete Permanently',
    consequences,
  };
}

const columns: ColumnDef<WorkEntity>[] = [
  { key: 'workID', label: 'ID', width: '5%' },
  { key: 'title', label: 'Title', width: '28%' },
  { key: 'type', label: 'Type', width: '10%' },
  { key: 'status', label: 'Status', width: '10%' },
  { key: 'quality', label: 'Quality', width: '10%' },
  { key: 'collectionList', label: 'Collections', width: '15%' },
  { key: 'nWords', label: 'Words', width: '8%', align: 'right' },
  { key: 'nSubmissions', label: 'Subs', width: '7%', align: 'right' },
  { key: 'nNotes', label: 'Notes', width: '7%', align: 'right' },
];

const fields: FieldDef<WorkEntity>[] = [
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'type', label: 'Type', type: 'select' },
  { key: 'status', label: 'Status', type: 'select' },
  { key: 'quality', label: 'Quality', type: 'select' },
];

export const worksContract: EntityContract<WorkEntity, number> = {
  entityType: 'work',
  entityName: 'Work',
  pluralName: 'Works',
  idField: 'id',

  columns,
  fields,

  actions: {
    list: async () => {
      const works = await GetWorks();
      return (works ?? []).map(toWorkEntity);
    },
    get: async (id: number) => {
      // GetWork returns models.Work, not WorkView. For now use GetWorks and filter.
      const works = await GetWorks();
      const work = works?.find((w) => w.workID === id);
      if (!work) throw new Error(`Work ${id} not found`);
      return toWorkEntity(work);
    },
    // update: not implemented yet - UpdateWork takes a full Work object
    delete: async (id: number) => {
      await DeleteWork(id);
    },
    undelete: async (id: number) => {
      await UndeleteWork(id);
    },
    permanentDelete: async (id: number) => {
      await DeleteWorkPermanent(id, false);
    },
    getDeleteConfirmation: async (id: number): Promise<DeleteConfirmation> => {
      const conf = await GetWorkDeleteConfirmation(id);
      return dbConfToScaffoldConf(conf);
    },
  },
};

export default worksContract;
