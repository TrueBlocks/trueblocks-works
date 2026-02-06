import { models } from '@models';

const PAGE_WIDTH_IN = 6.0;
const PAGE_HEIGHT_IN = 9.0;
const MARGIN_IN = 0.75;
const DEFAULT_FONT = 'Garamond, Georgia, serif';
const HEADING_SIZE = 18;
const NORMAL_SIZE = 11;

function getBaseStyles(): string {
  return `
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
}`;
}

function wrapPage(styles: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
${getBaseStyles()}
${styles}
</style>
</head>
<body>
<div class="page">
  <div class="content">
    ${body}
  </div>
</div>
</body>
</html>`;
}

interface BookPageParams {
  book: models.Book;
}

export function generateCopyrightHTML({ book }: BookPageParams): string {
  const copyright = book.copyright || '';
  const copyrightLines = copyright.split('\n').filter((line) => line.trim());

  const linesHTML = copyrightLines
    .map((line) => `<p class="copyrightText">${line}</p>`)
    .join('\n      ');

  const styles = `
.topSection {
  padding-top: 33%;
}
.copyrightText {
  font-family: '${DEFAULT_FONT}', serif;
  font-size: ${NORMAL_SIZE}pt;
  font-weight: normal;
  line-height: 1.6;
  color: #000;
  margin-bottom: 0.5em;
}`;

  const body = `
    <div class="topSection">
      ${linesHTML || '<p class="copyrightText">© [Year] [Publisher]</p>'}
    </div>`;

  return wrapPage(styles, body);
}

export function generateDedicationHTML({ book }: BookPageParams): string {
  const dedication = book.dedication || '';
  const dedicationLines = dedication.split('\n').filter((line) => line.trim());

  const linesHTML = dedicationLines
    .map((line) => `<p class="dedicationText">${line}</p>`)
    .join('\n      ');

  const styles = `
.topThird {
  padding-top: 33%;
}
.dedicationText {
  text-align: center;
  font-family: '${DEFAULT_FONT}', serif;
  font-size: 12pt;
  font-style: italic;
  font-weight: normal;
  line-height: 1.6;
  color: #000;
  margin-bottom: 0.3em;
}`;

  const body = `
    <div class="topThird">
      ${linesHTML || '<p class="dedicationText"></p>'}
    </div>`;

  return wrapPage(styles, body);
}

export function generateAcknowledgementsHTML({ book }: BookPageParams): string {
  const acknowledgements = book.acknowledgements || '';
  const lines = acknowledgements.split('\n').filter((line) => line.trim());

  const linesHTML = lines.map((line) => `<p class="bodyText">${line}</p>`).join('\n      ');

  const styles = `
.headingSection {
  padding-top: 10%;
  margin-bottom: 1.5em;
}
.headingText {
  text-align: center;
  font-family: '${DEFAULT_FONT}', serif;
  font-size: ${HEADING_SIZE}pt;
  font-weight: normal;
  color: #000;
}
.bodyText {
  font-family: '${DEFAULT_FONT}', serif;
  font-size: ${NORMAL_SIZE}pt;
  font-weight: normal;
  line-height: 1.6;
  color: #000;
  margin-bottom: 0.5em;
}`;

  const body = `
    <div class="headingSection">
      <p class="headingText">Acknowledgements</p>
    </div>
    <div class="bodySection">
      ${linesHTML || '<p class="bodyText"></p>'}
    </div>`;

  return wrapPage(styles, body);
}

export function generateAboutAuthorHTML({ book }: BookPageParams): string {
  const aboutAuthor = book.aboutAuthor || '';
  const lines = aboutAuthor.split('\n').filter((line) => line.trim());

  const linesHTML = lines.map((line) => `<p class="bodyText">${line}</p>`).join('\n      ');

  const styles = `
.headingSection {
  padding-top: 10%;
  margin-bottom: 1.5em;
}
.headingText {
  text-align: center;
  font-family: '${DEFAULT_FONT}', serif;
  font-size: ${HEADING_SIZE}pt;
  font-weight: normal;
  color: #000;
}
.bodyText {
  font-family: '${DEFAULT_FONT}', serif;
  font-size: ${NORMAL_SIZE}pt;
  font-weight: normal;
  line-height: 1.6;
  color: #000;
  margin-bottom: 0.5em;
}`;

  const body = `
    <div class="headingSection">
      <p class="headingText">About the Author</p>
    </div>
    <div class="bodySection">
      ${linesHTML || '<p class="bodyText"></p>'}
    </div>`;

  return wrapPage(styles, body);
}
