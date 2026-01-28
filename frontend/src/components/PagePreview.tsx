import { ReactNode } from 'react';
import classes from './PagePreview.module.css';

const PAGE_WIDTH_INCHES = 6;
const PAGE_HEIGHT_INCHES = 9;
const SCALE = 0.75;
const PPI = 96;

const PAGE_WIDTH_PX = PAGE_WIDTH_INCHES * PPI * SCALE;
const PAGE_HEIGHT_PX = PAGE_HEIGHT_INCHES * PPI * SCALE;

const MARGIN_TOP_INCHES = 0.75;
const MARGIN_BOTTOM_INCHES = 0.75;
const MARGIN_LEFT_INCHES = 0.75;
const MARGIN_RIGHT_INCHES = 0.75;

const MARGIN_TOP_PX = MARGIN_TOP_INCHES * PPI * SCALE;
const MARGIN_BOTTOM_PX = MARGIN_BOTTOM_INCHES * PPI * SCALE;
const MARGIN_LEFT_PX = MARGIN_LEFT_INCHES * PPI * SCALE;
const MARGIN_RIGHT_PX = MARGIN_RIGHT_INCHES * PPI * SCALE;

interface PagePreviewProps {
  children: ReactNode;
}

export function PagePreview({ children }: PagePreviewProps) {
  return (
    <div className={classes.pageContainer}>
      <div
        className={classes.page}
        style={{
          width: PAGE_WIDTH_PX,
          height: PAGE_HEIGHT_PX,
          paddingTop: MARGIN_TOP_PX,
          paddingBottom: MARGIN_BOTTOM_PX,
          paddingLeft: MARGIN_LEFT_PX,
          paddingRight: MARGIN_RIGHT_PX,
        }}
      >
        <div className={classes.pageContent}>{children}</div>
      </div>
    </div>
  );
}

export { PAGE_WIDTH_PX, PAGE_HEIGHT_PX, SCALE };
export { MARGIN_TOP_PX, MARGIN_BOTTOM_PX, MARGIN_LEFT_PX, MARGIN_RIGHT_PX };
