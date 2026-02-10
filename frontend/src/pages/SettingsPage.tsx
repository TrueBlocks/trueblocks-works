import { useState, useEffect } from 'react';
import {
  Stack,
  TextInput,
  Button,
  Group,
  Text,
  Paper,
  Loader,
  Flex,
  Switch,
  Select,
  PasswordInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconFolder,
  IconCheck,
  IconSettings,
  IconList,
  IconPlayerPlay,
  IconSearch,
  IconBrain,
} from '@tabler/icons-react';
import { GetSettings, UpdateSettings, BrowseForFolder } from '@app';
import { settings } from '@models';
import { TabView, Tab, EnumManagement, FTSStatus } from '@/components';
import { SplashScreen } from '@trueblocks/ui';
import { ThemeSelector } from '@/components/ThemeSelector';
import { DarkModeSwitch } from '@/components/DarkModeSwitch';
import { useTabContext } from '@/stores/tabStore';

export function SettingsPage() {
  const [config, setConfig] = useState<settings.Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSplashPreview, setShowSplashPreview] = useState(false);
  const { setPageTabs } = useTabContext();

  const loadData = () => {
    setLoading(true);
    GetSettings()
      .then(setConfig)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update tab cycle based on analysis feature
  useEffect(() => {
    if (config) {
      const baseTabs = ['paths', 'field-values', 'search'];
      if (config.analysisEnabled) {
        setPageTabs('settings', [...baseTabs, 'analysis']);
      } else {
        setPageTabs('settings', baseTabs);
      }
    }
  }, [config, setPageTabs]);

  // Reload on Cmd+R
  useEffect(() => {
    function handleReload() {
      loadData();
    }
    window.addEventListener('reloadCurrentView', handleReload);
    return () => window.removeEventListener('reloadCurrentView', handleReload);
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
    } catch {
      notifications.show({
        title: 'Save Failed',
        message: 'Failed to save settings',
        color: 'red',
        autoClose: 5000,
      });
    } finally {
      setSaving(false);
    }
  };

  const autoSave = (updates: Partial<settings.Settings>) => {
    if (!config) return;
    const updated = { ...config, ...updates };
    setConfig(updated);
    UpdateSettings(updated).catch(() => {
      notifications.show({
        title: 'Save Failed',
        message: 'Failed to save settings',
        color: 'red',
        autoClose: 5000,
      });
    });
  };

  if (loading || !config) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Loader />
      </Flex>
    );
  }

  const tabs: Tab[] = [
    {
      value: 'paths',
      label: 'Paths',
      icon: <IconSettings size={16} />,
      content: (
        <Stack gap="lg" maw={700}>
          <Paper p="md" withBorder>
            <Stack gap="md">
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
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() => handleBrowse('templateFolderPath')}
                  >
                    <IconFolder size={16} />
                  </Button>
                }
              />

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

              <ThemeSelector />
              <DarkModeSwitch />

              <Group mt="md">
                <Button
                  variant="light"
                  leftSection={<IconPlayerPlay size={16} />}
                  onClick={() => setShowSplashPreview(true)}
                >
                  Preview Splash Screen
                </Button>
              </Group>
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
      ),
    },
    {
      value: 'field-values',
      label: 'Field Values',
      icon: <IconList size={16} />,
      content: <EnumManagement />,
    },
    {
      value: 'search',
      label: 'Search',
      icon: <IconSearch size={16} />,
      content: (
        <Stack gap="lg" maw={700}>
          <FTSStatus />
        </Stack>
      ),
    },
    {
      value: 'analysis',
      label: 'AI Analysis',
      icon: <IconBrain size={16} />,
      content: (
        <Stack gap="lg" maw={700}>
          <Paper p="md" withBorder>
            <Stack gap="md">
              <Switch
                label="Enable AI Analysis"
                description="Allow AI-powered analysis of works and collections"
                checked={config.analysisEnabled ?? false}
                onChange={(e) => autoSave({ analysisEnabled: e.currentTarget.checked })}
              />

              <Select
                label="AI Provider"
                description="Select which AI service to use for analysis"
                value={config.analysisProvider ?? 'openai'}
                onChange={(value) => autoSave({ analysisProvider: value ?? 'openai' })}
                data={[
                  { value: 'openai', label: 'OpenAI (GPT-4o)' },
                  { value: 'anthropic', label: 'Anthropic (Claude)' },
                  { value: 'ollama', label: 'Ollama (Local)' },
                ]}
              />

              <TextInput
                label="Model"
                description="Specific model to use (e.g., gpt-4o, claude-sonnet-4-20250514, llama3)"
                value={config.analysisModel ?? ''}
                onChange={(e) => autoSave({ analysisModel: e.currentTarget.value })}
                placeholder={
                  config.analysisProvider === 'anthropic'
                    ? 'claude-sonnet-4-20250514'
                    : config.analysisProvider === 'ollama'
                      ? 'llama3'
                      : 'gpt-4o'
                }
              />

              {(config.analysisProvider === 'openai' || !config.analysisProvider) && (
                <PasswordInput
                  label="OpenAI API Key"
                  description="Your OpenAI API key (starts with sk-)"
                  value={config.openAIAPIKey ?? ''}
                  onChange={(e) => autoSave({ openAIAPIKey: e.currentTarget.value })}
                  placeholder="sk-..."
                />
              )}

              {config.analysisProvider === 'anthropic' && (
                <PasswordInput
                  label="Anthropic API Key"
                  description="Your Anthropic API key"
                  value={config.anthropicAPIKey ?? ''}
                  onChange={(e) => autoSave({ anthropicAPIKey: e.currentTarget.value })}
                  placeholder="sk-ant-..."
                />
              )}

              {config.analysisProvider === 'ollama' && (
                <TextInput
                  label="Ollama Endpoint"
                  description="URL of your local Ollama server"
                  value={config.ollamaEndpoint ?? ''}
                  onChange={(e) => autoSave({ ollamaEndpoint: e.currentTarget.value })}
                  placeholder="http://localhost:11434"
                />
              )}
            </Stack>
          </Paper>
        </Stack>
      ),
    },
  ];

  return (
    <>
      {showSplashPreview && (
        <SplashScreen duration={2000} onComplete={() => setShowSplashPreview(false)} />
      )}
      <TabView pageName="settings" tabs={tabs} />
    </>
  );
}
