import { ReactNode } from 'react';
import classes from './PagePreview.module.css';

const PAGE_WIDTH_INCHES = 6;
const PAGE_HEIGHT_INCHES = 9;
const SCALE = 0.72;
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

interface TwoPageSpreadProps {
  versoContent: ReactNode;
  rectoContent: ReactNode;
}

export function TwoPageSpread({ versoContent, rectoContent }: TwoPageSpreadProps) {
  return (
    <div className={classes.twoPageSpread}>
      <div
        className={`${classes.page} ${classes.versoPage}`}
        style={{
          width: PAGE_WIDTH_PX,
          height: PAGE_HEIGHT_PX,
          paddingTop: MARGIN_TOP_PX,
          paddingBottom: MARGIN_BOTTOM_PX,
          paddingLeft: MARGIN_LEFT_PX,
          paddingRight: MARGIN_RIGHT_PX,
        }}
      >
        <div className={classes.pageContent}>{versoContent}</div>
      </div>
      <div
        className={`${classes.page} ${classes.rectoPage}`}
        style={{
          width: PAGE_WIDTH_PX,
          height: PAGE_HEIGHT_PX,
          paddingTop: MARGIN_TOP_PX,
          paddingBottom: MARGIN_BOTTOM_PX,
          paddingLeft: MARGIN_LEFT_PX,
          paddingRight: MARGIN_RIGHT_PX,
        }}
      >
        <div className={classes.pageContent}>{rectoContent}</div>
      </div>
    </div>
  );
}
