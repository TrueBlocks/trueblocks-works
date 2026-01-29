import { useRef, useState, useEffect } from 'react';
import classes from './PagePreview.module.css';

const MM_TO_PX = 3.7795275591;
const DEFAULT_DISPLAY_WIDTH = 403;

export interface PagePreviewProps {
  html: string;
  canvasWidthMM: number;
  canvasHeightMM: number;
  displayWidth?: number;
  fillWidth?: boolean;
}

export function PagePreview({
  html,
  canvasWidthMM,
  canvasHeightMM,
  displayWidth: targetWidth,
  fillWidth,
}: PagePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  useEffect(() => {
    if (!fillWidth || !containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width - 32);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [fillWidth]);

  const canvasWidthPx = canvasWidthMM * MM_TO_PX;
  const canvasHeightPx = canvasHeightMM * MM_TO_PX;
  const effectiveWidth =
    fillWidth && containerWidth ? containerWidth : (targetWidth ?? DEFAULT_DISPLAY_WIDTH);
  const scale = effectiveWidth / canvasWidthPx;
  const displayWidth = canvasWidthPx * scale;
  const displayHeight = canvasHeightPx * scale;

  return (
    <div ref={containerRef} className={classes.pageContainer}>
      <div
        style={{
          width: displayWidth,
          height: displayHeight,
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          borderRadius: 4,
        }}
      >
        <iframe
          srcDoc={html}
          style={{
            width: canvasWidthPx,
            height: canvasHeightPx,
            border: 'none',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
          title="Page Preview"
        />
      </div>
    </div>
  );
}
