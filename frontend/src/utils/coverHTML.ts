import { models } from '@models';

const COVER_WIDTH_MM = 334.6;
const COVER_HEIGHT_MM = 234.95;
const FRONT_COVER_WIDTH_MM = 152.4;
const BACK_COVER_WIDTH_MM = 152.4;
const SPINE_WIDTH_MM = 23.45;
const BLEED_MM = 3.17;
const BARCODE_WIDTH_MM = 50.8;
const BARCODE_HEIGHT_MM = 30.48;

const DEFAULT_FONT = 'Garamond, Georgia, serif';
const DEFAULT_BACKGROUND = '#F5F5DC';

interface CoverParams {
  book: models.Book;
  frontCoverDataUrl?: string;
  backCoverDataUrl?: string;
  isPreview?: boolean;
}

function getCoverStyles(backgroundColor: string): string {
  return `
@page {
  size: ${COVER_WIDTH_MM}mm ${COVER_HEIGHT_MM}mm;
  margin: 0;
}
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
html, body {
  width: ${COVER_WIDTH_MM}mm;
  height: ${COVER_HEIGHT_MM}mm;
  margin: 0;
  padding: 0;
}
body {
  font-family: ${DEFAULT_FONT};
  color: #000;
  background: ${backgroundColor};
}
.cover-canvas {
  width: ${COVER_WIDTH_MM}mm;
  height: ${COVER_HEIGHT_MM}mm;
  display: flex;
  flex-direction: row;
  position: relative;
}
.back-cover {
  width: ${BACK_COVER_WIDTH_MM + BLEED_MM}mm;
  height: ${COVER_HEIGHT_MM}mm;
  position: relative;
  background-color: ${backgroundColor};
  padding: ${BLEED_MM + 10}mm;
  padding-left: ${BLEED_MM + 15}mm;
  display: flex;
  flex-direction: column;
}
.spine {
  width: ${SPINE_WIDTH_MM}mm;
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
.isbn-area {
  position: absolute;
  bottom: ${BLEED_MM + 15}mm;
  left: ${BLEED_MM + 15}mm;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 9pt;
  color: #333;
}
.isbn-text {
  margin-bottom: 2mm;
}
.publisher-text {
  font-size: 8pt;
  color: #555;
}
.barcode-placeholder {
  width: ${BARCODE_WIDTH_MM}mm;
  height: ${BARCODE_HEIGHT_MM}mm;
  margin-top: 5mm;
  border: 1px dashed #999;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 7pt;
  color: #999;
  background: rgba(255,255,255,0.8);
}
`;
}

export function generateCoverHTML({
  book,
  frontCoverDataUrl,
  isPreview = true,
}: CoverParams): string {
  const backgroundColor = book.backgroundColor || DEFAULT_BACKGROUND;
  const title = book.title || '';
  const author = book.author || '';
  const spineText = [title, author].filter(Boolean).join(' · ');
  const description = book.descriptionLong || book.descriptionShort || '';
  const isbn = book.isbn || 'ISBN-PENDING';
  const publisher = book.publisher || 'Stony Lane Press';

  const frontCoverContent = frontCoverDataUrl
    ? `<img class="front-cover-image" src="${frontCoverDataUrl}" alt="Front Cover" />`
    : `<div style="width:100%;height:100%;background:${backgroundColor};display:flex;align-items:center;justify-content:center;color:#999;font-size:14pt;">Front Cover Image</div>`;

  const barcodeHtml = isPreview ? '<div class="barcode-placeholder">Barcode Area</div>' : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
${getCoverStyles(backgroundColor)}
</style>
</head>
<body>
<div class="cover-canvas">
  <div class="back-cover">
    <div class="description-area">
      <div class="description-text">${escapeHtml(description)}</div>
    </div>
    <div class="isbn-area">
      <div class="isbn-text">${escapeHtml(isbn)}</div>
      <div class="publisher-text">${escapeHtml(publisher)}</div>
      ${barcodeHtml}
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

export const COVER_DIMENSIONS = {
  widthMM: COVER_WIDTH_MM,
  heightMM: COVER_HEIGHT_MM,
  frontWidthMM: FRONT_COVER_WIDTH_MM,
  backWidthMM: BACK_COVER_WIDTH_MM,
  spineWidthMM: SPINE_WIDTH_MM,
  bleedMM: BLEED_MM,
};
