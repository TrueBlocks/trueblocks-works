import { useState, useEffect, useMemo } from 'react';
import { Modal, TextInput, Select, Button, Group, Stack, NumberInput } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  CreateSubmission,
  GetCollection,
  GetOrganizations,
  GetWorks,
  GetDistinctValues,
} from '@app';
import { models } from '@models';
import { LogErr, showValidationResult } from '@/utils';
import dayjs from 'dayjs';

interface CreateSubmissionModalProps {
  opened: boolean;
  onClose: () => void;
  onCreated?: (submissionId: number) => void;
  workID?: number;
  orgID?: number;
  collID?: number;
}

export function CreateSubmissionModal({
  opened,
  onClose,
  onCreated,
  workID,
  orgID,
  collID,
}: CreateSubmissionModalProps) {
  const [selectedWorkID, setSelectedWorkID] = useState<string | null>(null);
  const [selectedOrgID, setSelectedOrgID] = useState<string | null>(null);
  const [submissionDate, setSubmissionDate] = useState<string | null>(dayjs().format('MM/DD/YYYY'));
  const [submissionType, setSubmissionType] = useState<string | null>(null);
  const [contestName, setContestName] = useState('');
  const [cost, setCost] = useState<number | string>('');
  const [webAddress, setWebAddress] = useState('');

  const [works, setWorks] = useState<models.WorkView[]>([]);
  const [orgs, setOrgs] = useState<models.Organization[]>([]);
  const [typeOptions, setTypeOptions] = useState<string[]>([]);
  const [collectionName, setCollectionName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!opened) return;

    if (collID) {
      GetCollection(collID)
        .then((c) => setCollectionName(c?.collectionName || `Collection #${collID}`))
        .catch((err) => LogErr('Failed to load collection:', err));
    } else if (!workID) {
      GetWorks()
        .then((w) => setWorks(w || []))
        .catch((err) => LogErr('Failed to load works:', err));
    }
    if (!orgID) {
      GetOrganizations()
        .then((o) => setOrgs(o || []))
        .catch((err) => LogErr('Failed to load organizations:', err));
    }
    GetDistinctValues('Submissions', 'submission_type')
      .then((v) => setTypeOptions(v || []))
      .catch((err) => LogErr('Failed to load submission types:', err));
  }, [opened, workID, orgID, collID]);

  const workOptions = useMemo(
    () =>
      works.map((w) => ({
        value: String(w.workID),
        label: w.title || `Work #${w.workID}`,
      })),
    [works]
  );

  const orgOptions = useMemo(
    () =>
      orgs.map((o) => ({
        value: String(o.orgID),
        label: o.name || `Org #${o.orgID}`,
      })),
    [orgs]
  );

  const resolvedWorkID = collID || workID || (selectedWorkID ? Number(selectedWorkID) : 0);
  const resolvedOrgID = orgID || (selectedOrgID ? Number(selectedOrgID) : 0);
  const canSubmit = resolvedWorkID > 0 && resolvedOrgID > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setLoading(true);
    try {
      const sub = new models.Submission({
        workID: resolvedWorkID,
        orgID: resolvedOrgID,
        isCollection: !!collID,
        submissionDate: submissionDate || undefined,
        submissionType: submissionType || undefined,
        contestName: contestName || undefined,
        cost: cost !== '' ? Number(cost) : undefined,
        webAddress: webAddress || undefined,
        responseType: 'Waiting',
      });

      const result = await CreateSubmission(sub);
      if (showValidationResult(result)) {
        setLoading(false);
        return;
      }

      notifications.show({
        title: 'Submission created',
        message: 'Submission record added successfully',
        color: 'green',
      });
      onCreated?.(sub.submissionID);
      handleClose();
    } catch (err) {
      LogErr('Failed to create submission:', err);
      notifications.show({
        title: 'Error',
        message: String(err) || 'Failed to create submission',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedWorkID(null);
    setSelectedOrgID(null);
    setSubmissionDate(dayjs().format('MM/DD/YYYY'));
    setSubmissionType(null);
    setContestName('');
    setCost('');
    setWebAddress('');
    setCollectionName('');
    onClose();
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="New Submission" size="md">
      <Stack gap="md">
        {collID ? (
          <TextInput label="Collection" value={collectionName} readOnly />
        ) : (
          !workID && (
            <Select
              label="Work"
              placeholder="Select a work..."
              data={workOptions}
              value={selectedWorkID}
              onChange={setSelectedWorkID}
              required
              searchable
              nothingFoundMessage="No works found"
            />
          )
        )}

        {!orgID && (
          <Select
            label="Organization"
            placeholder="Select an organization..."
            data={orgOptions}
            value={selectedOrgID}
            onChange={setSelectedOrgID}
            required
            searchable
            nothingFoundMessage="No organizations found"
          />
        )}

        <DateInput
          label="Submission Date"
          value={submissionDate}
          onChange={setSubmissionDate}
          valueFormat="MM/DD/YYYY"
          clearable
        />

        <Select
          label="Submission Type"
          placeholder="Select type..."
          data={typeOptions}
          value={submissionType}
          onChange={setSubmissionType}
          searchable
          clearable
        />

        <TextInput
          label="Contest Name"
          placeholder="e.g. Omnidawn 2026 1st/2nd Poetry Book Contest"
          value={contestName}
          onChange={(e) => setContestName(e.target.value)}
        />

        <NumberInput
          label="Cost"
          placeholder="0.00"
          value={cost}
          onChange={setCost}
          min={0}
          decimalScale={2}
          prefix="$"
        />

        <TextInput
          label="Web Address"
          placeholder="https://..."
          value={webAddress}
          onChange={(e) => setWebAddress(e.target.value)}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading} disabled={!canSubmit || loading}>
            Create Submission
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
