import classes from './PagePreview.module.css';

const DISPLAY_SCALE = 0.7;
const PAGE_WIDTH_PX = 576;
const PAGE_HEIGHT_PX = 864;

export interface PagePreviewProps {
  html: string;
}

export function PagePreview({ html }: PagePreviewProps) {
  return (
    <div className={classes.pageContainer}>
      <div
        style={{
          width: PAGE_WIDTH_PX * DISPLAY_SCALE,
          height: PAGE_HEIGHT_PX * DISPLAY_SCALE,
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        }}
      >
        <iframe
          srcDoc={html}
          style={{
            width: PAGE_WIDTH_PX,
            height: PAGE_HEIGHT_PX,
            border: 'none',
            transform: `scale(${DISPLAY_SCALE})`,
            transformOrigin: 'top left',
          }}
          title="Page Preview"
        />
      </div>
    </div>
  );
}

export { PAGE_WIDTH_PX, PAGE_HEIGHT_PX, DISPLAY_SCALE };
