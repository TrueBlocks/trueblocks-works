import { models } from '@models';

// KDP cover dimension constants (fixed values)
const FRONT_COVER_WIDTH_MM = 152.4; // 6 inches
const BACK_COVER_WIDTH_MM = 152.4; // 6 inches
const COVER_HEIGHT_MM = 234.95; // 9.25 inches
const BLEED_MM = 3.17; // 0.125 inches
const BARCODE_WIDTH_MM = 50.8;
const BARCODE_HEIGHT_MM = 30.48;

// Default spine for preview when galley doesn't exist yet
const DEFAULT_SPINE_WIDTH_MM = 23.45;
const DEFAULT_COVER_WIDTH_MM =
  BACK_COVER_WIDTH_MM + DEFAULT_SPINE_WIDTH_MM + FRONT_COVER_WIDTH_MM + BLEED_MM * 2;

const DEFAULT_FONT = 'Garamond, Georgia, serif';
const DEFAULT_BACKGROUND = '#F5F5DC';

interface CoverDimensions {
  spineMM: number;
  widthMM: number;
  heightMM: number;
}

interface CoverParams {
  book: models.Book;
  frontCoverDataUrl?: string;
  backCoverDataUrl?: string;
  isPreview?: boolean;
  dimensions?: CoverDimensions;
}

function getCoverStyles(
  backgroundColor: string,
  spineMM: number,
  coverWidthMM: number,
  isPreview: boolean
): string {
  // Calculate trim area (inside bleed on all sides)
  const trimWidth = coverWidthMM - BLEED_MM * 2;
  const trimHeight = COVER_HEIGHT_MM - BLEED_MM * 2;

  // For preview, we show a larger canvas with visible bleed area
  // For export, the cover fills the entire page
  const previewPadding = isPreview ? 8 : 0; // Extra padding around bleed for visual clarity

  return `
@page {
  size: ${coverWidthMM}mm ${COVER_HEIGHT_MM}mm;
  margin: 0;
}
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
html, body {
  width: ${isPreview ? coverWidthMM + previewPadding * 2 : coverWidthMM}mm;
  height: ${isPreview ? COVER_HEIGHT_MM + previewPadding * 2 : COVER_HEIGHT_MM}mm;
  margin: 0;
  padding: 0;
}
body {
  font-family: ${DEFAULT_FONT};
  color: #000;
  background: ${isPreview ? '#e0e0e0' : backgroundColor};
  ${isPreview ? `padding: ${previewPadding}mm;` : ''}
}
.cover-wrapper {
  width: ${coverWidthMM}mm;
  height: ${COVER_HEIGHT_MM}mm;
  position: relative;
  background: ${isPreview ? '#fff' : 'transparent'};
}
${
  isPreview
    ? `
.trim-guide {
  position: absolute;
  top: ${BLEED_MM}mm;
  left: ${BLEED_MM}mm;
  width: ${trimWidth}mm;
  height: ${trimHeight}mm;
  border: 2px solid #000;
  pointer-events: none;
  z-index: 1000;
}
.bleed-label {
  position: absolute;
  top: 1mm;
  left: 50%;
  transform: translateX(-50%);
  font-size: 6pt;
  color: #666;
  background: rgba(255,255,255,0.8);
  padding: 0.5mm 2mm;
  border-radius: 1mm;
  z-index: 1001;
}
`
    : ''
}
.cover-canvas {
  width: ${coverWidthMM}mm;
  height: ${COVER_HEIGHT_MM}mm;
  display: flex;
  flex-direction: row;
  position: relative;
  background: ${backgroundColor};
}
.back-cover {
  width: ${BACK_COVER_WIDTH_MM + BLEED_MM}mm;
  height: ${COVER_HEIGHT_MM}mm;
  position: relative;
  background-color: ${backgroundColor};
  padding: ${BLEED_MM + 10}mm;
  padding-left: ${BLEED_MM + 15}mm;
  padding-bottom: ${BLEED_MM + 8}mm;
  display: flex;
  flex-direction: column;
}
.spine {
  width: ${spineMM}mm;
  height: ${COVER_HEIGHT_MM}mm;
  background-color: ${backgroundColor};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  position: relative;
  padding: 8mm 0;
}
.spine-text {
  writing-mode: vertical-rl;
  font-family: ${DEFAULT_FONT};
  font-size: 12pt;
  letter-spacing: 0.05em;
  color: #333;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-height: 180mm;
  flex: 1;
  display: flex;
  align-items: center;
}
.spine-logo {
  width: 18mm;
  height: 18mm;
  background-color: #1e3a5f;
  border-radius: 2mm;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.spine-logo-text {
  font-family: 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif;
  font-size: 9pt;
  font-weight: bold;
  font-style: italic;
  color: ${backgroundColor};
  letter-spacing: 0.08em;
}
.front-cover {
  width: ${FRONT_COVER_WIDTH_MM + BLEED_MM}mm;
  height: ${COVER_HEIGHT_MM}mm;
  position: relative;
  overflow: hidden;
}
.front-cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
.description-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding-top: 15mm;
  max-width: ${BACK_COVER_WIDTH_MM - 30}mm;
}
.description-text {
  font-family: ${DEFAULT_FONT};
  font-size: 11pt;
  line-height: 1.6;
  color: #222;
  text-align: left;
  white-space: pre-wrap;
}
.barcode-placeholder {
  width: ${BARCODE_WIDTH_MM}mm;
  height: ${BARCODE_HEIGHT_MM}mm;
  border: 1px dashed #999;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 7pt;
  color: #999;
  background: rgba(255,255,255,0.8);
}
.back-cover-bottom {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: auto;
  width: 100%;
}
.publisher-area {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 8pt;
  color: #555;
  text-align: left;
}
.barcode-area {
  text-align: right;
}
`;
}

export function generateCoverHTML({
  book,
  frontCoverDataUrl,
  isPreview = true,
  dimensions,
}: CoverParams): string {
  // Use provided dimensions or defaults
  const spineMM = dimensions?.spineMM ?? DEFAULT_SPINE_WIDTH_MM;
  const coverWidthMM = dimensions?.widthMM ?? DEFAULT_COVER_WIDTH_MM;

  const backgroundColor = book.backgroundColor || DEFAULT_BACKGROUND;
  const title = book.title || '';
  const author = book.author || '';
  const spineText = [title, author].filter(Boolean).join(' · ');
  const description = book.descriptionLong || book.descriptionShort || '';
  const publisher = book.publisher || 'Stony Lane Press';

  const frontCoverContent = frontCoverDataUrl
    ? `<img class="front-cover-image" src="${frontCoverDataUrl}" alt="Front Cover" />`
    : `<div style="width:100%;height:100%;background:${backgroundColor};display:flex;align-items:center;justify-content:center;color:#999;font-size:14pt;">Front Cover Image</div>`;

  const barcodeHtml = isPreview
    ? '<div class="barcode-placeholder">Barcode Area<br/>(Amazon places ISBN here)</div>'
    : '';
  const trimGuideHtml = isPreview
    ? '<div class="trim-guide"></div><div class="bleed-label">← Bleed Area (will be trimmed) →</div>'
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
${getCoverStyles(backgroundColor, spineMM, coverWidthMM, isPreview)}
</style>
</head>
<body>
<div class="cover-wrapper">
  ${trimGuideHtml}
  <div class="cover-canvas">
    <div class="back-cover">
      <div class="description-area">
        <div class="description-text">${escapeHtml(description)}</div>
      </div>
      <div class="back-cover-bottom">
        <div class="publisher-area">${escapeHtml(publisher)}</div>
        <div class="barcode-area">${barcodeHtml}</div>
      </div>
    </div>
    <div class="spine">
      <span class="spine-text">${escapeHtml(spineText)}</span>
      <div class="spine-logo">
        <span class="spine-logo-text">SLP</span>
      </div>
    </div>
    <div class="front-cover">
      ${frontCoverContent}
    </div>
  </div>
</div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>');
}

// Dynamic dimensions based on galley page count
export function getCoverDimensions(spineMM: number): {
  widthMM: number;
  heightMM: number;
  frontWidthMM: number;
  backWidthMM: number;
  spineWidthMM: number;
  bleedMM: number;
} {
  const widthMM = BACK_COVER_WIDTH_MM + spineMM + FRONT_COVER_WIDTH_MM + 2 * BLEED_MM;
  return {
    widthMM,
    heightMM: COVER_HEIGHT_MM,
    frontWidthMM: FRONT_COVER_WIDTH_MM,
    backWidthMM: BACK_COVER_WIDTH_MM,
    spineWidthMM: spineMM,
    bleedMM: BLEED_MM,
  };
}

// Default dimensions for when galley isn't available (preview only)
export const DEFAULT_COVER_DIMENSIONS = {
  widthMM: DEFAULT_COVER_WIDTH_MM,
  heightMM: COVER_HEIGHT_MM,
  frontWidthMM: FRONT_COVER_WIDTH_MM,
  backWidthMM: BACK_COVER_WIDTH_MM,
  spineWidthMM: DEFAULT_SPINE_WIDTH_MM,
  bleedMM: BLEED_MM,
};
