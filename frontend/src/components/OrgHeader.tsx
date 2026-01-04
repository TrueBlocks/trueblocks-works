import { Group, Title, Text, Badge, ActionIcon, Stack, Button, Tooltip } from '@mantine/core';
import { IconArrowLeft, IconExternalLink } from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { models } from '@wailsjs/go/models';
import { OrgStatusBadge } from '@/components';
import {
  OpenOrgURL,
  OpenOrgOtherURL,
  OpenDuotrope,
  UpdateOrganization,
} from '@wailsjs/go/main/App';

const STATUS_CYCLE = ['Open', 'Boring', 'Defunct'] as const;

interface OrgHeaderProps {
  org: models.Organization;
  onStatusChange?: (newStatus: string) => void;
}

export function OrgHeader({ org, onStatusChange }: OrgHeaderProps) {
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
          <Title order={2}>{org.name}</Title>
          {org.otherName && (
            <Text size="sm" c="dimmed">
              {org.otherName}
            </Text>
          )}
          <Group gap="xs" mt="xs">
            <Badge variant="light">{org.type}</Badge>
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
