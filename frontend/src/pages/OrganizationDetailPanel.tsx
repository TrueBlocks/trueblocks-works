import { Paper, SimpleGrid, Text, Stack, Box } from '@mantine/core';
import { models } from '@models';
import { EditableField, EntityFieldSelect } from '@trueblocks/ui';
import { GetDistinctValues, UpdateOrganization } from '@app';
import { LogErr, showValidationResult } from '@/utils';
import { useMemo, useCallback } from 'react';

interface OrganizationDetailPanelProps {
  org: models.Organization;
  onUpdate?: (org: models.Organization) => void;
}

function Field({ label, value }: { label: string; value?: string | number }) {
  if (!value) return null;
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
        {label}
      </Text>
      <Text size="sm">{value}</Text>
    </div>
  );
}

export function OrganizationDetailPanel({ org, onUpdate }: OrganizationDetailPanelProps) {
  const handleFieldChange = (field: keyof models.Organization, value: string) => {
    if (onUpdate) {
      onUpdate({ ...org, [field]: value } as models.Organization);
    }
  };

  const updateOrgField = useCallback(async (o: models.Organization) => {
    const result = await UpdateOrganization(o);
    if (showValidationResult(result)) return { hasErrors: true };
  }, []);

  const loadMyInterestOptions = useMemo(
    () => () => GetDistinctValues('Organizations', 'my_interest').then((v) => v || []),
    []
  );

  return (
    <Paper p="md" withBorder>
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <EditableField
            label="Website URL"
            placeholder="https://..."
            value={org.url || ''}
            onChange={(value) => handleFieldChange('url', value)}
          />
          <EditableField
            label="Other URL"
            placeholder="https://..."
            value={org.otherURL || ''}
            onChange={(value) => handleFieldChange('otherURL', value)}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          <Field label="Accepts" value={org.accepts} />
          <Field label="Submission Types" value={org.submissionTypes} />
          <Box>
            <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
              My Interest
            </Text>
            <EntityFieldSelect
              entity={org}
              field="myInterest"
              loadOptions={loadMyInterestOptions}
              updateEntity={updateOrgField}
              width={100}
              onUpdate={onUpdate}
              onError={(err, field) => LogErr(`Failed to update ${field}:`, err)}
            />
          </Box>
          <Field label="Source" value={org.source} />
          <Field label="Duotrope #" value={org.duotropeNum} />
          <Field label="Website Menu" value={org.websiteMenu} />
        </SimpleGrid>

        {(org.contestEnds || org.contestFee || org.contestPrize) && (
          <>
            <Text size="sm" fw={600} mt="sm">
              Contest Info
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
              <Field label="Contest Ends" value={org.contestEnds} />
              <Field label="Entry Fee" value={org.contestFee} />
              <Field label="Prize" value={org.contestPrize} />
              <Field label="2nd Prize" value={org.contestPrize2} />
            </SimpleGrid>
          </>
        )}

        <Text size="sm" fw={600} mt="sm">
          Push Counts
        </Text>
        <SimpleGrid cols={3} spacing="md">
          <Field label="Fiction" value={org.nPushFiction} />
          <Field label="Nonfiction" value={org.nPushNonfiction} />
          <Field label="Poetry" value={org.nPushPoetry} />
        </SimpleGrid>
      </Stack>
    </Paper>
  );
}
