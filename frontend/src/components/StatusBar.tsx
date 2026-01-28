import { useState, useEffect, useCallback, useRef } from 'react';
import { EventsOn, EventsOff } from '@wailsjs/runtime/runtime';
import { Log } from '@/utils';
import styles from './StatusBar.module.css';

interface StatusMessage {
  level: string;
  message: string;
}

const LEVEL_CONFIG: Record<string, { prefix: string; duration: number }> = {
  info: { prefix: 'ℹ️', duration: 2000 },
  progress: { prefix: '📄', duration: 2000 },
  success: { prefix: '✓', duration: 3000 },
  error: { prefix: '✗', duration: 10000 },
};

interface StatusBarProps {
  sidebarWidth: number;
}

export function StatusBar({ sidebarWidth }: StatusBarProps) {
  const [visible, setVisible] = useState(false);
  const [currentMessage, setCurrentMessage] = useState<StatusMessage | null>(null);
  const [copied, setCopied] = useState(false);
  const [isHeld, setIsHeld] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(
    (duration: number) => {
      clearHideTimeout();
      hideTimeoutRef.current = setTimeout(() => {
        setVisible(false);
      }, duration);
    },
    [clearHideTimeout]
  );

  useEffect(() => {
    const handleMessage = (msg: StatusMessage) => {
      Log('StatusBar received:', msg.level, msg.message);
      setCurrentMessage(msg);
      setVisible(true);
      setCopied(false);

      // Only schedule auto-hide if bar is not held open
      if (!isHeld) {
        const config = LEVEL_CONFIG[msg.level] || LEVEL_CONFIG.info;
        scheduleHide(config.duration);
      }
    };

    const handleOpen = () => {
      Log('StatusBar: held open');
      setIsHeld(true);
      setVisible(true);
      clearHideTimeout();
    };

    const handleClose = () => {
      Log('StatusBar: closing');
      setIsHeld(false);
      // Brief delay to show final message before hiding
      scheduleHide(500);
    };

    EventsOn('status:message', handleMessage);
    EventsOn('status:open', handleOpen);
    EventsOn('status:close', handleClose);

    return () => {
      EventsOff('status:message');
      EventsOff('status:open');
      EventsOff('status:close');
      clearHideTimeout();
    };
  }, [isHeld, scheduleHide, clearHideTimeout]);

  const handleCopy = useCallback(() => {
    if (currentMessage) {
      navigator.clipboard.writeText(currentMessage.message);
      setCopied(true);
    }
  }, [currentMessage]);

  if (!currentMessage) {
    return null;
  }

  const config = LEVEL_CONFIG[currentMessage.level] || LEVEL_CONFIG.info;
  const levelClass =
    styles[`level${currentMessage.level.charAt(0).toUpperCase()}${currentMessage.level.slice(1)}`];

  return (
    <div
      className={`${styles.statusBar} ${visible ? styles.statusBarVisible : ''}`}
      style={{ left: sidebarWidth }}
    >
      <span className={`${styles.message} ${levelClass}`}>
        <span className={styles.prefix}>{config.prefix}</span>
        {currentMessage.message}
      </span>
      {currentMessage.level === 'error' && (
        <button type="button" className={styles.copyButton} onClick={handleCopy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      )}
    </div>
  );
}
