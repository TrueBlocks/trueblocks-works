import { useState, useEffect } from 'react';
import { Stack, Title, TextInput, Button, Group, Text, Paper, Loader, Flex } from '@mantine/core';
import { IconFolder, IconCheck } from '@tabler/icons-react';
import { GetSettings, UpdateSettings, BrowseForFolder } from '@wailsjs/go/main/App';
import { LogErr } from '@/utils';
import { settings } from '@wailsjs/go/models';

export function SettingsPage() {
  const [config, setConfig] = useState<settings.Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    GetSettings()
      .then(setConfig)
      .finally(() => setLoading(false));
  }, []);

  const handleBrowse = async (field: keyof settings.Settings) => {
    const path = await BrowseForFolder(`Select ${field}`);
    if (path && config) {
      setConfig({ ...config, [field]: path });
      setSaved(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await UpdateSettings(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      LogErr('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Loader />
      </Flex>
    );
  }

  return (
    <Stack gap="lg" maw={700}>
      <Title order={2}>Settings</Title>

      <Paper p="md" withBorder>
        <Stack gap="md">
          <Title order={4}>File Paths</Title>

          <TextInput
            label="Works Base Folder"
            description="Root folder containing your work files organized by year"
            value={config.baseFolderPath}
            onChange={(e) => {
              setConfig({ ...config, baseFolderPath: e.currentTarget.value });
              setSaved(false);
            }}
            rightSection={
              <Button size="xs" variant="subtle" onClick={() => handleBrowse('baseFolderPath')}>
                <IconFolder size={16} />
              </Button>
            }
          />

          <TextInput
            label="PDF Preview Cache"
            description="Folder where PDF previews are stored"
            value={config.pdfPreviewPath}
            onChange={(e) => {
              setConfig({ ...config, pdfPreviewPath: e.currentTarget.value });
              setSaved(false);
            }}
            rightSection={
              <Button size="xs" variant="subtle" onClick={() => handleBrowse('pdfPreviewPath')}>
                <IconFolder size={16} />
              </Button>
            }
          />

          <TextInput
            label="Submission Export Folder"
            description="Where files are copied when exporting for submission"
            value={config.submissionExportPath}
            onChange={(e) => {
              setConfig({ ...config, submissionExportPath: e.currentTarget.value });
              setSaved(false);
            }}
            rightSection={
              <Button
                size="xs"
                variant="subtle"
                onClick={() => handleBrowse('submissionExportPath')}
              >
                <IconFolder size={16} />
              </Button>
            }
          />

          <TextInput
            label="Template Folder"
            description="Folder containing template files for new works"
            value={config.templateFolderPath}
            onChange={(e) => {
              setConfig({ ...config, templateFolderPath: e.currentTarget.value });
              setSaved(false);
            }}
            rightSection={
              <Button size="xs" variant="subtle" onClick={() => handleBrowse('templateFolderPath')}>
                <IconFolder size={16} />
              </Button>
            }
          />
        </Stack>
      </Paper>

      <Paper p="md" withBorder>
        <Stack gap="md">
          <Title order={4}>LibreOffice</Title>
          <TextInput
            label="LibreOffice Path"
            description="Path to soffice executable for PDF generation"
            value={config.libreOfficePath || ''}
            onChange={(e) => {
              setConfig({ ...config, libreOfficePath: e.currentTarget.value });
              setSaved(false);
            }}
          />
          <Text size="xs" c="dimmed">
            Default: /Applications/LibreOffice.app/Contents/MacOS/soffice
          </Text>
        </Stack>
      </Paper>

      <Group>
        <Button
          onClick={handleSave}
          loading={saving}
          leftSection={saved ? <IconCheck size={16} /> : undefined}
        >
          {saved ? 'Saved' : 'Save Settings'}
        </Button>
      </Group>
    </Stack>
  );
}
