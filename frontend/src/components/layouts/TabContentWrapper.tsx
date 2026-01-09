import { Stack, type StackProps } from '@mantine/core';

interface TabContentWrapperProps extends StackProps {
  children: React.ReactNode;
}

export function TabContentWrapper({ children, ...props }: TabContentWrapperProps) {
  return (
    <Stack gap="md" {...props}>
      {children}
    </Stack>
  );
}
