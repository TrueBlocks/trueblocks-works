import { useState, useEffect } from 'react';
import { Center, Stack, Title, Text, Box } from '@mantine/core';
import { EventsOn, EventsOff } from '@wailsjs/runtime/runtime';

interface SplashScreenProps {
  duration?: number;
  onComplete: () => void;
}

export function SplashScreen({ duration = 2000, onComplete }: SplashScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);
  const [statusText, setStatusText] = useState('');

  useEffect(() => {
    const handleStatus = (data: { message: string }) => {
      setStatusText(data.message);
    };

    EventsOn('startup:status', handleStatus);

    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, duration - 300);

    const completeTimer = setTimeout(() => {
      onComplete();
    }, duration);

    return () => {
      EventsOff('startup:status');
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [duration, onComplete]);

  return (
    <Box
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 300ms ease-out',
      }}
    >
      <Center h="100%">
        <Stack align="center" gap="lg">
          {/* Factory/Studio inspired design */}
          <Box
            style={{
              width: 120,
              height: 120,
              border: '3px solid rgba(255, 255, 255, 0.8)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {/* Stylized "W" */}
            <Text
              style={{
                fontSize: 72,
                fontWeight: 300,
                color: 'rgba(255, 255, 255, 0.9)',
                fontFamily: 'Georgia, serif',
                letterSpacing: -4,
              }}
            >
              W
            </Text>
            {/* Corner accent - like a ledger binding */}
            <Box
              style={{
                position: 'absolute',
                top: -3,
                left: -3,
                width: 20,
                height: 20,
                borderTop: '3px solid rgba(255, 255, 255, 0.8)',
                borderLeft: '3px solid rgba(255, 255, 255, 0.8)',
                borderRadius: '8px 0 0 0',
              }}
            />
          </Box>

          <Stack align="center" gap={4}>
            <Title
              order={1}
              style={{
                color: 'white',
                fontWeight: 400,
                letterSpacing: 8,
                textTransform: 'uppercase',
                fontSize: 32,
              }}
            >
              Works
            </Title>
            <Text
              size="md"
              style={{
                color: 'rgba(255, 255, 255, 0.6)',
                fontStyle: 'italic',
                letterSpacing: 2,
              }}
            >
              A Studio Ledger
            </Text>
            {statusText && (
              <Text
                size="xs"
                style={{
                  color: 'rgba(255, 255, 255, 0.4)',
                  marginTop: 8,
                }}
              >
                {statusText}
              </Text>
            )}
          </Stack>

          {/* Subtle loading indicator */}
          <Box
            style={{
              width: 40,
              height: 2,
              background: 'rgba(255, 255, 255, 0.3)',
              borderRadius: 1,
              overflow: 'hidden',
              marginTop: 20,
            }}
          >
            <Box
              style={{
                width: '100%',
                height: '100%',
                background: 'rgba(255, 255, 255, 0.8)',
                animation: 'loading 1.5s ease-in-out infinite',
              }}
            />
          </Box>
        </Stack>
      </Center>

      <style>
        {`
          @keyframes loading {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(100%); }
            100% { transform: translateX(-100%); }
          }
        `}
      </style>
    </Box>
  );
}
