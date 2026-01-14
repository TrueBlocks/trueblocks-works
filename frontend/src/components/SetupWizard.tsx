import { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Stepper,
  Button,
  Group,
  TextInput,
  Stack,
  Text,
  Alert,
  ActionIcon,
  Badge,
  Card,
  Title,
  ThemeIcon,
  Loader,
} from '@mantine/core';
import {
  IconFolder,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconFileText,
  IconSettings,
  IconDatabase,
  IconRocket,
} from '@tabler/icons-react';
import {
  GetSettings,
  UpdateSettings,
  BrowseForFolder,
  DetectLibreOffice,
  PathExists,
  CompleteSetup,
} from '@app';
import { settings } from '@models';

interface SetupWizardProps {
  opened: boolean;
  onComplete: () => void;
}

type PathStatus = 'checking' | 'valid' | 'invalid' | 'unknown';

function PathStatusIcon({ status }: { status: PathStatus }) {
  switch (status) {
    case 'checking':
      return <Loader size="xs" />;
    case 'valid':
      return <IconCheck size={16} color="green" />;
    case 'invalid':
      return <IconX size={16} color="red" />;
    default:
      return null;
  }
}

export function SetupWizard({ opened, onComplete }: SetupWizardProps) {
  const [active, setActive] = useState(0);
  const [settings, setSettings] = useState<settings.Settings | null>(null);
  const [pathStatuses, setPathStatuses] = useState<Record<string, PathStatus>>({});
  const [libreOfficeDetected, setLibreOfficeDetected] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const checkAllPaths = useCallback(async (s: settings.Settings) => {
    const paths = {
      baseFolderPath: s.baseFolderPath,
      pdfPreviewPath: s.pdfPreviewPath,
      submissionExportPath: s.submissionExportPath,
      templateFolderPath: s.templateFolderPath,
      libreOfficePath: s.libreOfficePath || '',
    };

    setPathStatuses((prev) => {
      const newStatuses: Record<string, PathStatus> = {};
      for (const key of Object.keys(paths)) {
        newStatuses[key] = 'checking';
      }
      return { ...prev, ...newStatuses };
    });

    for (const [key, path] of Object.entries(paths)) {
      if (!path) {
        setPathStatuses((prev) => ({ ...prev, [key]: 'unknown' }));
        continue;
      }
      const exists = await PathExists(path);
      setPathStatuses((prev) => ({ ...prev, [key]: exists ? 'valid' : 'invalid' }));
    }
  }, []);

  useEffect(() => {
    if (!opened) return;

    GetSettings().then((s) => {
      setSettings(s);
      checkAllPaths(s);
    });

    DetectLibreOffice().then((path) => {
      setLibreOfficeDetected(path);
    });
  }, [opened, checkAllPaths]);

  async function handleBrowse(field: string) {
    const path = await BrowseForFolder(`Select ${field}`);
    if (path && settings) {
      const updated = { ...settings, [field]: path } as settings.Settings;
      setSettings(updated);
      const exists = await PathExists(path);
      setPathStatuses(
        (prev) => ({ ...prev, [field]: exists ? 'valid' : 'invalid' }) as Record<string, PathStatus>
      );
    }
  }

  function handlePathChange(field: string, value: string) {
    if (settings) {
      setSettings({ ...settings, [field]: value } as settings.Settings);
      setPathStatuses((prev) => ({ ...prev, [field]: 'unknown' }) as Record<string, PathStatus>);
    }
  }

  async function validateCurrentPath(field: string) {
    if (!settings) return;
    const path = settings[field as keyof settings.Settings] as string;
    if (!path) {
      setPathStatuses((prev) => ({ ...prev, [field]: 'unknown' }));
      return;
    }
    setPathStatuses((prev) => ({ ...prev, [field]: 'checking' }));
    const exists = await PathExists(path);
    setPathStatuses((prev) => ({ ...prev, [field]: exists ? 'valid' : 'invalid' }));
  }

  function useDetectedLibreOffice() {
    if (settings && libreOfficeDetected) {
      setSettings({ ...settings, libreOfficePath: libreOfficeDetected });
      setPathStatuses((prev) => ({ ...prev, libreOfficePath: 'valid' }));
    }
  }

  async function handleComplete() {
    if (!settings) return;
    setSaving(true);
    await UpdateSettings(settings);
    await CompleteSetup();
    setSaving(false);
    onComplete();
  }

  function nextStep() {
    setActive((prev) => Math.min(prev + 1, 3));
  }

  function prevStep() {
    setActive((prev) => Math.max(prev - 1, 0));
  }

  if (!settings) return null;

  const allPathsValid =
    pathStatuses.baseFolderPath === 'valid' && pathStatuses.templateFolderPath === 'valid';

  return (
    <Modal
      opened={opened}
      onClose={() => {}}
      title={
        <Group>
          <ThemeIcon size="lg" variant="light" color="blue">
            <IconRocket size={20} />
          </ThemeIcon>
          <Title order={3}>Welcome to Works</Title>
        </Group>
      }
      size="lg"
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={false}
    >
      <Stepper active={active} onStepClick={setActive} size="sm" mt="md">
        <Stepper.Step label="Folders" description="Configure paths" icon={<IconFolder size={18} />}>
          <Stack mt="md" gap="sm">
            <Text size="sm" c="dimmed">
              Configure where Works stores your files. These paths should already exist on your
              computer.
            </Text>

            <TextInput
              label="Base Folder Path"
              description="Root folder containing your work files"
              value={settings.baseFolderPath}
              onChange={(e) => handlePathChange('baseFolderPath', e.target.value)}
              onBlur={() => validateCurrentPath('baseFolderPath')}
              rightSection={
                <Group gap={4}>
                  <PathStatusIcon status={pathStatuses.baseFolderPath} />
                  <ActionIcon variant="subtle" onClick={() => handleBrowse('baseFolderPath')}>
                    <IconFolder size={16} />
                  </ActionIcon>
                </Group>
              }
              rightSectionWidth={60}
            />

            <TextInput
              label="Template Folder Path"
              description="Folder containing templates for new works"
              value={settings.templateFolderPath}
              onChange={(e) => handlePathChange('templateFolderPath', e.target.value)}
              onBlur={() => validateCurrentPath('templateFolderPath')}
              rightSection={
                <Group gap={4}>
                  <PathStatusIcon status={pathStatuses.templateFolderPath} />
                  <ActionIcon variant="subtle" onClick={() => handleBrowse('templateFolderPath')}>
                    <IconFolder size={16} />
                  </ActionIcon>
                </Group>
              }
              rightSectionWidth={60}
            />

            <TextInput
              label="PDF Preview Path"
              description="Folder for storing PDF previews"
              value={settings.pdfPreviewPath}
              onChange={(e) => handlePathChange('pdfPreviewPath', e.target.value)}
              onBlur={() => validateCurrentPath('pdfPreviewPath')}
              rightSection={
                <Group gap={4}>
                  <PathStatusIcon status={pathStatuses.pdfPreviewPath} />
                  <ActionIcon variant="subtle" onClick={() => handleBrowse('pdfPreviewPath')}>
                    <IconFolder size={16} />
                  </ActionIcon>
                </Group>
              }
              rightSectionWidth={60}
            />

            <TextInput
              label="Submission Export Path"
              description="Folder for exporting submission packages"
              value={settings.submissionExportPath}
              onChange={(e) => handlePathChange('submissionExportPath', e.target.value)}
              onBlur={() => validateCurrentPath('submissionExportPath')}
              rightSection={
                <Group gap={4}>
                  <PathStatusIcon status={pathStatuses.submissionExportPath} />
                  <ActionIcon variant="subtle" onClick={() => handleBrowse('submissionExportPath')}>
                    <IconFolder size={16} />
                  </ActionIcon>
                </Group>
              }
              rightSectionWidth={60}
            />
          </Stack>
        </Stepper.Step>

        <Stepper.Step
          label="LibreOffice"
          description="Document conversion"
          icon={<IconFileText size={18} />}
        >
          <Stack mt="md" gap="md">
            <Text size="sm" c="dimmed">
              LibreOffice is used to convert Word documents to PDF for preview. It&apos;s optional
              but recommended.
            </Text>

            {libreOfficeDetected ? (
              <Alert icon={<IconCheck size={16} />} color="green" title="LibreOffice Detected">
                <Stack gap="xs">
                  <Text size="sm">Found at: {libreOfficeDetected}</Text>
                  {settings.libreOfficePath !== libreOfficeDetected && (
                    <Button size="xs" variant="light" onClick={useDetectedLibreOffice}>
                      Use This Path
                    </Button>
                  )}
                </Stack>
              </Alert>
            ) : (
              <Alert
                icon={<IconAlertCircle size={16} />}
                color="yellow"
                title="LibreOffice Not Found"
              >
                <Text size="sm">
                  LibreOffice was not detected. You can install it from{' '}
                  <Text component="a" href="https://www.libreoffice.org" c="blue">
                    libreoffice.org
                  </Text>{' '}
                  or via Homebrew: <code>brew install --cask libreoffice</code>
                </Text>
              </Alert>
            )}

            <TextInput
              label="LibreOffice Path"
              description="Path to soffice executable"
              value={settings.libreOfficePath || ''}
              onChange={(e) => handlePathChange('libreOfficePath', e.target.value)}
              onBlur={() => validateCurrentPath('libreOfficePath')}
              rightSection={
                <Group gap={4}>
                  <PathStatusIcon status={pathStatuses.libreOfficePath} />
                  <ActionIcon variant="subtle" onClick={() => handleBrowse('libreOfficePath')}>
                    <IconFolder size={16} />
                  </ActionIcon>
                </Group>
              }
              rightSectionWidth={60}
            />
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Database" description="Data storage" icon={<IconDatabase size={18} />}>
          <Stack mt="md" gap="md">
            <Text size="sm" c="dimmed">
              Works stores all your data in a local SQLite database. The database will be created
              automatically in your home directory.
            </Text>

            <Card withBorder p="md">
              <Stack gap="xs">
                <Group>
                  <Text fw={500}>Database Location:</Text>
                  <Badge variant="light">~/.works/works.db</Badge>
                </Group>
                <Group>
                  <Text fw={500}>Backups:</Text>
                  <Badge variant="light">~/.works/backups/</Badge>
                </Group>
                <Group>
                  <Text fw={500}>Settings:</Text>
                  <Badge variant="light">~/.works/config.json</Badge>
                </Group>
              </Stack>
            </Card>

            <Alert icon={<IconCheck size={16} />} color="blue">
              <Text size="sm">
                Automatic backups are enabled. Use <kbd>⌘⇧B</kbd> to access backup management.
              </Text>
            </Alert>
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Complete" description="Ready to go" icon={<IconSettings size={18} />}>
          <Stack mt="md" gap="md" align="center">
            <ThemeIcon size={60} radius="xl" variant="light" color="green">
              <IconCheck size={30} />
            </ThemeIcon>

            <Title order={4}>You&apos;re All Set!</Title>

            <Text size="sm" c="dimmed" ta="center">
              Works is configured and ready to use. You can change these settings anytime from the
              Settings page.
            </Text>

            {!allPathsValid && (
              <Alert icon={<IconAlertCircle size={16} />} color="yellow">
                <Text size="sm">
                  Some paths don&apos;t exist yet. Works will create them as needed, or you can go
                  back and fix them now.
                </Text>
              </Alert>
            )}

            <Card withBorder p="md" w="100%">
              <Stack gap="xs">
                <Text fw={500} size="sm">
                  Keyboard Shortcuts:
                </Text>
                <Group gap="lg">
                  <Text size="sm">
                    <kbd>⌘K</kbd> Search
                  </Text>
                  <Text size="sm">
                    <kbd>⌘⇧B</kbd> Backups
                  </Text>
                  <Text size="sm">
                    <kbd>⌘1-4</kbd> Navigate
                  </Text>
                </Group>
              </Stack>
            </Card>
          </Stack>
        </Stepper.Step>
      </Stepper>

      <Group justify="flex-end" mt="xl">
        {active > 0 && (
          <Button variant="default" onClick={prevStep}>
            Back
          </Button>
        )}
        {active < 3 ? (
          <Button onClick={nextStep}>Next</Button>
        ) : (
          <Button onClick={handleComplete} loading={saving} leftSection={<IconRocket size={16} />}>
            Get Started
          </Button>
        )}
      </Group>
    </Modal>
  );
}
