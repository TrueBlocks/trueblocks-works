import { Group, Text, Badge, ActionIcon, Stack, Button, Tooltip } from '@mantine/core';
import { IconArrowLeft, IconExternalLink } from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { models } from '@wailsjs/go/models';
import { OrgStatusBadge, EditableField, SelectablePopover } from '@/components';
import {
  OpenOrgURL,
  OpenOrgOtherURL,
  OpenDuotrope,
  UpdateOrganization,
} from '@wailsjs/go/main/App';

const STATUS_CYCLE = ['Open', 'Boring', 'Defunct'] as const;

interface OrgHeaderProps {
  org: models.Organization;
  typeOptions?: readonly string[];
  onStatusChange?: (newStatus: string) => void;
  onNameChange?: (newName: string) => void;
  onTypeChange?: (newType: string) => void;
}

export function OrgHeader({
  org,
  typeOptions = [],
  onStatusChange,
  onNameChange,
  onTypeChange,
}: OrgHeaderProps) {
  const navigate = useNavigate();

  const handleOpenURL = () => OpenOrgURL(org.orgID);
  const handleOpenOtherURL = () => OpenOrgOtherURL(org.orgID);
  const handleOpenDuotrope = () => OpenDuotrope(org.orgID);

  const handleCycleStatus = async () => {
    const currentIndex = STATUS_CYCLE.indexOf(org.status as (typeof STATUS_CYCLE)[number]);
    const nextIndex = (currentIndex + 1) % STATUS_CYCLE.length;
    const newStatus = STATUS_CYCLE[nextIndex];

    const updatedOrg = { ...org, status: newStatus };
    await UpdateOrganization(updatedOrg as models.Organization);
    onStatusChange?.(newStatus);
  };

  return (
    <Group justify="space-between" align="flex-start">
      <Group>
        <ActionIcon variant="subtle" onClick={() => navigate(-1)}>
          <IconArrowLeft size={20} />
        </ActionIcon>
        <div>
          <EditableField
            value={org.name || ''}
            onChange={(value) => onNameChange?.(value)}
            placeholder="Organization name"
          />
          {org.otherName && (
            <Text size="sm" c="dimmed">
              {org.otherName}
            </Text>
          )}
          <Group gap="xs" mt="xs">
            <SelectablePopover
              options={typeOptions}
              value={org.type || ''}
              onChange={(value) => onTypeChange?.(value)}
              label="Type"
            >
              <Badge variant="light" style={{ cursor: 'pointer' }}>
                {org.type || '(No type)'}
              </Badge>
            </SelectablePopover>
            <Tooltip label="Click to cycle status">
              <div style={{ cursor: 'pointer' }} onClick={handleCycleStatus}>
                <OrgStatusBadge status={org.status} />
              </div>
            </Tooltip>
            {org.timing && <Badge variant="outline">{org.timing}</Badge>}
          </Group>
        </div>
      </Group>
      <Stack gap="xs" align="flex-end">
        <Group gap="xs">
          {org.url && (
            <Tooltip label={org.url}>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconExternalLink size={14} />}
                onClick={handleOpenURL}
              >
                Website
              </Button>
            </Tooltip>
          )}
          {org.otherURL && (
            <Tooltip label={org.otherURL}>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconExternalLink size={14} />}
                onClick={handleOpenOtherURL}
              >
                Other
              </Button>
            </Tooltip>
          )}
          {org.duotropeNum && org.duotropeNum > 0 && (
            <Button size="xs" variant="light" color="grape" onClick={handleOpenDuotrope}>
              Duotrope
            </Button>
          )}
        </Group>
        {org.ranking && (
          <Badge color="yellow" variant="light">
            Ranking: {org.ranking}
          </Badge>
        )}
      </Stack>
    </Group>
  );
}
