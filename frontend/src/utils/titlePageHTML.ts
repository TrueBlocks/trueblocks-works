import { models, app } from '@models';

const PAGE_WIDTH_IN = 6.0;
const PAGE_HEIGHT_IN = 9.0;
const MARGIN_IN = 0.75;
const DEFAULT_FONT = 'Garamond, Georgia, serif';

interface TitlePageParams {
  book: models.Book;
  collectionName: string;
  templateStyles: app.TitlePageStyleInfo | null;
}

export function generateTitlePageHTML({
  book,
  collectionName,
  templateStyles,
}: TitlePageParams): string {
  const title = (book.title || collectionName).replace(/ \| /g, '<br>');
  const subtitle = book.subtitle?.replace(/ \| /g, '<br>') || '';
  const author = book.author?.replace(/ \| /g, '<br>') || '';

  const titleFont = templateStyles?.titleFont || DEFAULT_FONT;
  const titleSize = templateStyles?.titleSize || 36;
  const titleColor = templateStyles?.titleColor || '000000';
  const titleOffset = book.titleOffsetY ?? 0;

  const subtitleFont = templateStyles?.subtitleFont || DEFAULT_FONT;
  const subtitleSize = templateStyles?.subtitleSize || 24;
  const subtitleColor = templateStyles?.subtitleColor || '000000';
  const subtitleOffset = book.subtitleOffsetY ?? 0;

  const authorFont = templateStyles?.authorFont || DEFAULT_FONT;
  const authorSize = templateStyles?.authorSize || 18;
  const authorColor = templateStyles?.authorColor || '000000';
  const authorOffset = book.authorOffsetY ?? 0;

  let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@page {
  size: ${PAGE_WIDTH_IN}in ${PAGE_HEIGHT_IN}in;
  margin: 0;
}
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
html, body {
  width: ${PAGE_WIDTH_IN}in;
  height: ${PAGE_HEIGHT_IN}in;
  margin: 0;
  padding: 0;
}
body {
  font-family: serif;
  color: #000;
  background: white;
}
.page {
  width: 100%;
  height: 100%;
  padding: ${MARGIN_IN}in;
  box-sizing: border-box;
}
.content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.topThird {
  padding-top: 33%;
}
.spacer8 {
  height: 8pt;
}
.spacer32 {
  height: 32pt;
}
.titleText {
  text-align: center;
  font-family: '${titleFont}', serif;
  font-size: ${titleSize}pt;
  font-weight: normal;
  line-height: 1.2;
  color: #${titleColor};
  transform: translateY(${titleOffset}px);
}
.subtitleText {
  text-align: center;
  font-family: '${subtitleFont}', serif;
  font-size: ${subtitleSize}pt;
  font-weight: normal;
  line-height: 1.3;
  color: #${subtitleColor};
  transform: translateY(${subtitleOffset}px);
}
.authorText {
  text-align: center;
  font-family: '${authorFont}', serif;
  font-size: ${authorSize}pt;
  font-weight: normal;
  line-height: 1.4;
  color: #${authorColor};
  transform: translateY(${authorOffset}px);
}
</style>
</head>
<body>
<div class="page">
  <div class="content">
    <div class="topThird">
      <p class="titleText">${title}</p>`;

  if (subtitle) {
    html += `
      <div class="spacer8"></div>
      <p class="subtitleText">${subtitle}</p>`;
  }

  html += `
      <div class="spacer32"></div>
      <p class="authorText">${author}</p>
    </div>
  </div>
</div>
</body>
</html>`;

  return html;
}
