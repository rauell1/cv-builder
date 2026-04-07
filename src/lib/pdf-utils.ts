/**
 * Shared PDF Utilities
 *
 * Common functions used across all PDF generation routes (CV + Cover Letter).
 */

import { PDFFont, rgb, PDFPage } from 'pdf-lib';

// A4 page dimensions in points
export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;

// mm to pt conversion (1mm = 2.835pt)
export const MM_TO_PT = 2.835;

/**
 * Split text into lines that fit within maxWidth for a given font/size.
 * Used by both CV and Cover Letter PDF generators.
 */
export function splitTextIntoLines(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  if (!text) return [''];
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  const splitLongWord = (word: string): string[] => {
    if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) return [word];
    const chunks: string[] = [];
    let chunk = '';
    for (const ch of word) {
      const candidate = `${chunk}${ch}`;
      if (font.widthOfTextAtSize(candidate, fontSize) > maxWidth && chunk) {
        chunks.push(chunk);
        chunk = ch;
      } else {
        chunk = candidate;
      }
    }
    if (chunk) chunks.push(chunk);
    return chunks;
  };

  for (const rawWord of words) {
    const parts = splitLongWord(rawWord);
    for (const word of parts) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);
      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [''];
}

/**
 * Split text into lines for justification (returns array of word arrays).
 * Each inner array is one line worth of words.
 */
export function splitTextIntoWordLines(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[][] {
  if (!text) return [[]];
  const words = text.split(' ').filter(Boolean);
  if (words.length === 0) return [[]];

  const lines: string[][] = [];
  let currentLine: string[] = [];
  let currentWidth = 0;
  const spaceWidth = font.widthOfTextAtSize(' ', fontSize);

  for (const word of words) {
    const wordWidth = font.widthOfTextAtSize(word, fontSize);
    const neededWidth = currentLine.length > 0 ? currentWidth + spaceWidth + wordWidth : wordWidth;

    if (neededWidth > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = [word];
      currentWidth = wordWidth;
    } else {
      currentLine.push(word);
      currentWidth = neededWidth;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [[]];
}

/**
 * Draw a single justified line of text on a page.
 * Distributes extra space evenly between words.
 */
export function drawJustifiedLine(
  page: PDFPage,
  words: string[],
  x: number,
  y: number,
  fontSize: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
  maxWidth: number
): void {
  if (words.length === 0) return;

  if (words.length === 1) {
    page.drawText(words[0], { x, y, size: fontSize, font, color });
    return;
  }

  // Calculate total word width and distribute space
  const wordWidths = words.map(w => font.widthOfTextAtSize(w, fontSize));
  const totalWordWidth = wordWidths.reduce((a, b) => a + b, 0);
  const totalSpace = maxWidth - totalWordWidth;
  const spaceWidth = totalSpace / (words.length - 1);

  let currentX = x;
  for (let i = 0; i < words.length; i++) {
    page.drawText(words[i], { x: currentX, y, size: fontSize, font, color });
    currentX += wordWidths[i];
    if (i < words.length - 1) {
      currentX += spaceWidth;
    }
  }
}

/**
 * Draw a justified paragraph on a page.
 * All lines except the last are justified; the last line is left-aligned.
 * Returns the new Y position after the paragraph.
 */
export function drawJustifiedParagraph(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
  lineSpacing: number = 3
): number {
  const wordLines = splitTextIntoWordLines(text, font, fontSize, maxWidth);

  for (let i = 0; i < wordLines.length; i++) {
    const words = wordLines[i];
    const isLastLine = i === wordLines.length - 1;

    if (isLastLine || words.length <= 1) {
      // Last line: left-aligned
      page.drawText(words.join(' '), { x, y, size: fontSize, font, color });
    } else {
      // Justified line
      drawJustifiedLine(page, words, x, y, fontSize, font, color, maxWidth);
    }

    y -= (fontSize + lineSpacing);
  }

  return y;
}

/**
 * Safely escape a string for embedding in Python triple-quoted strings.
 */
export function escapePythonString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
    .replace(/\t/g, '\\t');
}

// Common colors
export const COLORS = {
  black: rgb(0, 0, 0),
  white: rgb(1, 1, 1),
  dark: rgb(0.1, 0.1, 0.1),
  medium: rgb(0.3, 0.3, 0.3),
  gray: rgb(0.4, 0.4, 0.4),
  lightGray: rgb(0.85, 0.85, 0.85),
  euBlue: rgb(0, 0.2, 0.6),
  teal: rgb(0, 0.502, 0.502),
  euBodyText: rgb(30 / 255, 30 / 255, 30 / 255),
};

/**
 * Build a contact parts array from personal info, filtering empty values.
 */
export function buildContactParts(info: {
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  website?: string;
}): string[] {
  const parts: string[] = [];
  if (info.email) parts.push(info.email);
  if (info.phone) parts.push(info.phone);
  if (info.location) parts.push(info.location);
  if (info.linkedin) parts.push(info.linkedin);
  if (info.github) parts.push(info.github);
  if (info.website) parts.push(info.website);
  return parts;
}

/**
 * Track which PDF documents have already registered fontkit.
 * Prevents duplicate registration which can cause subtle rendering issues.
 */
const registeredFontkitDocs = new WeakSet<import('pdf-lib').PDFDocument>();

/**
 * Load and embed a NotoSans font from the public/fonts directory.
 * Fontkit is registered exactly once per document (tracked via WeakSet).
 */
export async function embedNotoSansFont(
  doc: import('pdf-lib').PDFDocument,
  fontFile: string
): Promise<PDFFont> {
  const fsPromises = await import('fs/promises');
  const path = await import('path');
  const fontPath = path.join(process.cwd(), 'public', 'fonts', fontFile);
  const fallbackFontUrls: Record<string, string> = {
    'NotoSans-Regular.ttf': 'https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf',
    'NotoSans-Bold.ttf': 'https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf',
    'NotoSans-Italic.ttf': 'https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Italic.ttf',
    'NotoSans-BoldItalic.ttf': 'https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-BoldItalic.ttf',
  };

  let fontBytes: Buffer;
  try {
    fontBytes = await fsPromises.readFile(fontPath);
  } catch (err) {
    const url = fallbackFontUrls[fontFile];
    if (!url) throw err;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch fallback font ${fontFile} (HTTP ${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    fontBytes = Buffer.from(arrayBuffer);
  }

  if (!registeredFontkitDocs.has(doc)) {
    const fontkit = await import('@pdf-lib/fontkit');
    doc.registerFontkit(fontkit.default || fontkit);
    registeredFontkitDocs.add(doc);
  }
  return doc.embedFont(fontBytes);
}
