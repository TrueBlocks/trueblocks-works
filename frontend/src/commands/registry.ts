import {
  IconFileCheck,
  IconFolder,
  IconArchive,
  IconCategory,
  IconStars,
  IconArrowMoveRight,
  // IconTemplate, // Commented out with apply-template batch
} from '@tabler/icons-react';
import type { TablerIcon } from '@tabler/icons-react';

export type CommandScope = 'works' | 'submissions' | 'collections' | 'global';
export type CommandType = 'field' | 'action';

export interface Command {
  id: string;
  label: string;
  scope: CommandScope;
  type: CommandType;
  // For field updates - the field name to update
  field?: 'status' | 'type' | 'quality' | 'docType';
  // For actions - a unique action identifier
  action?: 'revealInFinder' | 'backupFiles' | 'moveFiles' | 'applyTemplate';
  icon?: TablerIcon;
  description?: string;
}

export const fieldLabels: Record<string, string> = {
  status: 'Status',
  type: 'Type',
  quality: 'Quality',
};

export const commands: Command[] = [
  // Field update commands
  {
    id: 'set-status',
    label: 'Set Status',
    scope: 'works',
    type: 'field',
    field: 'status',
    icon: IconFileCheck,
    description: 'Change the status of marked works',
  },
  {
    id: 'set-type',
    label: 'Set Type',
    scope: 'works',
    type: 'field',
    field: 'type',
    icon: IconCategory,
    description: 'Change the type of marked works',
  },
  {
    id: 'set-quality',
    label: 'Set Quality',
    scope: 'works',
    type: 'field',
    field: 'quality',
    icon: IconStars,
    description: 'Change the quality rating of marked works',
  },
  // Action commands
  {
    id: 'backup-files',
    label: 'Backup Files',
    scope: 'works',
    type: 'action',
    action: 'backupFiles',
    icon: IconArchive,
    description: 'Create backups of marked work files',
  },
  {
    id: 'reveal-in-finder',
    label: 'Open in Finder',
    scope: 'works',
    type: 'action',
    action: 'revealInFinder',
    icon: IconFolder,
    description: 'Show marked work files in Finder',
  },
  {
    id: 'move-files',
    label: 'Move Files to Generated Path',
    scope: 'works',
    type: 'action',
    action: 'moveFiles',
    icon: IconArrowMoveRight,
    description: 'Move marked files to their generated paths',
  },
  // {
  //   id: 'apply-template',
  //   label: 'Apply Template',
  //   scope: 'works',
  //   type: 'action',
  //   action: 'applyTemplate',
  //   icon: IconTemplate,
  //   description: 'Sync styles, theme, and clean formatting for marked works',
  // },
];

export function getCommandsForScope(scope: CommandScope): Command[] {
  return commands.filter((cmd) => cmd.scope === scope);
}

export function filterCommands(commands: Command[], query: string): Command[] {
  if (!query.trim()) return commands;
  const lowerQuery = query.toLowerCase();
  return commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(lowerQuery) ||
      cmd.description?.toLowerCase().includes(lowerQuery)
  );
}
