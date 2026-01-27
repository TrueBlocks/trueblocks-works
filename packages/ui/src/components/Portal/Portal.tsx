import { ReactNode, useState } from 'react';
import { Collapse, Group, UnstyledButton, Text } from '@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';

export interface PortalProps {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  rightSection?: ReactNode;
}

export function Portal({ title, icon, defaultOpen = false, children, rightSection }: PortalProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div>
      <UnstyledButton onClick={() => setIsOpen((o) => !o)} style={{ width: '100%' }} py="xs">
        <Group justify="space-between">
          <Group gap="xs">
            {isOpen ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
            {icon}
            <Text fw={500}>{title}</Text>
          </Group>
          {rightSection}
        </Group>
      </UnstyledButton>
      <Collapse in={isOpen}>
        <div style={{ paddingLeft: 24, paddingTop: 8, paddingBottom: 8 }}>{children}</div>
      </Collapse>
    </div>
  );
}
