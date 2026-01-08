import { Group, Text, Badge, ActionIcon, Stack, Button, Tooltip } from '@mantine/core';
import { IconArrowLeft, IconExternalLink } from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { models } from '@wailsjs/go/models';
import { EditableField, OrgFieldSelect } from '@/components';
import { orgStatusColors } from '@/types';
import { OpenOrgURL, OpenOrgOtherURL, OpenDuotrope } from '@wailsjs/go/main/App';

interface OrgHeaderProps {
  org: models.Organization;
  onOrgUpdate?: (org: models.Organization) => void;
  onNameChange?: (newName: string) => void;
  actions?: React.ReactNode;
}

export function OrgHeader({ org, onOrgUpdate, onNameChange, actions }: OrgHeaderProps) {
  const navigate = useNavigate();

  const handleOpenURL = () => OpenOrgURL(org.orgID);
  const handleOpenOtherURL = () => OpenOrgOtherURL(org.orgID);
  const handleOpenDuotrope = () => OpenDuotrope(org.orgID);

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
            <OrgFieldSelect org={org} field="type" onUpdate={onOrgUpdate} width={100} />
            <OrgFieldSelect
              org={org}
              field="status"
              colorMap={orgStatusColors}
              onUpdate={onOrgUpdate}
              width={100}
            />
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
        {actions}
      </Stack>
    </Group>
  );
}
