import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, PDFPage, PDFFont, StandardFonts } from 'pdf-lib';
import type { ParsedCV, CVFormatId } from '@/lib/cv-types';
import { buildContactParts, PAGE_WIDTH, PAGE_HEIGHT, splitTextIntoWordLines, embedNotoSansFont } from '@/lib/pdf-utils';
import { sanitizeParsedCV } from '@/lib/text-cleaning';

// ===== FONT LOADING =====

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
}

async function loadFonts(doc: PDFDocument): Promise<Fonts> {
  try {
    const [regular, bold, italic, boldItalic] = await Promise.all([
      embedNotoSansFont(doc, 'NotoSans-Regular.ttf'),
      embedNotoSansFont(doc, 'NotoSans-Bold.ttf'),
      embedNotoSansFont(doc, 'NotoSans-Italic.ttf'),
      embedNotoSansFont(doc, 'NotoSans-BoldItalic.ttf'),
    ]);
    return { regular, bold, italic, boldItalic };
  } catch (err) {
    console.warn('[generate-pdf] Noto fonts unavailable, falling back to standard PDF fonts:', err instanceof Error ? err.message : err);
    const [regular, bold, italic, boldItalic] = await Promise.all([
      doc.embedFont(StandardFonts.Helvetica),
      doc.embedFont(StandardFonts.HelveticaBold),
      doc.embedFont(StandardFonts.HelveticaOblique),
      doc.embedFont(StandardFonts.HelveticaBoldOblique),
    ]);
    return { regular, bold, italic, boldItalic };
  }
}

// ===== TEXT UTILITIES =====

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
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
 * Draw justified words on a page at position (x, y).
 * Distributes space evenly BETWEEN WORDS (not between characters).
 * Last line and single-word lines are left-aligned.
 */
function drawJustifiedWordsOnPage(
  page: PDFPage, words: string[], x: number, y: number,
  fontSize: number, font: PDFFont, color: ReturnType<typeof rgb>, maxWidth: number
): void {
  if (words.length <= 1) {
    page.drawText(words.join(' '), { x, y, size: fontSize, font, color });
    return;
  }
  const wordWidths = words.map(w => font.widthOfTextAtSize(w, fontSize));
  const totalWordWidth = wordWidths.reduce((a, b) => a + b, 0);
  const totalSpace = maxWidth - totalWordWidth;
  const gapWidth = totalSpace / (words.length - 1);
  let currentX = x;
  for (let i = 0; i < words.length; i++) {
    page.drawText(words[i], { x: currentX, y, size: fontSize, font, color });
    currentX += wordWidths[i];
    if (i < words.length - 1) currentX += gapWidth;
  }
}

// ===== COLOR CONSTANTS =====
const EU_PRIMARY = rgb(0, 51 / 255, 153 / 255);        // #003399
const EU_BODY_TEXT = rgb(30 / 255, 30 / 255, 30 / 255); // #1e1e1e
const EU_BLACK = rgb(0, 0, 0);

// ===== LAYOUT CONSTANTS (mm to pt: 1mm = 2.8346pt) =====
const MM = 2.8346;
const EU_MARGIN = 15 * MM;           // ~42.52pt
const EU_CONTACT_X = 60 * MM;       // ~170pt
const EU_RIGHT_MARGIN = 15 * MM;
const EU_LINE_X_END = 195 * MM;
const EU_LEFT_COL_WIDTH = EU_CONTACT_X - EU_MARGIN;

// Font sizes (pt)
const EU_NAME_SIZE = 18;
const EU_SECTION_SIZE = 12;
const EU_TITLE_SIZE = 10;
const EU_BODY_SIZE = 9;
const EU_CONTACT_SIZE = 9;
const EU_DATE_SIZE = 9;
const EU_BULLET_SIZE = 9;

// Spacing (pt)
const EU_LINE_SPACING = 3.5;
const EU_SECTION_GAP_BEFORE = 4 * MM;
const EU_SECTION_GAP_AFTER = 4 * MM;
const EU_ENTRY_GAP = 1.5 * MM;
const EU_BULLET_PREFIX = '\u2022  ';

// Shared vertical rhythm for non-Europass formats
const PRO_LINE_SPACING = 4;
const PRO_SECTION_HEADER_GAP = 12;
const PRO_ENTRY_GAP = 6;

// ===================================================================
// EUROPASS FORMAT
// ===================================================================

interface PdfCtx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  fonts: Fonts;
}

function checkPage(ctx: PdfCtx, needed: number) {
  if (ctx.y - needed < EU_MARGIN) {
    ctx.page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    ctx.y = PAGE_HEIGHT - EU_MARGIN;
  }
}

function drawJustifiedBlock(ctx: PdfCtx, text: string, x: number, width: number, fontSize: number, color = EU_BODY_TEXT) {
  if (!text) return;
  const wordLines = splitTextIntoWordLines(text, ctx.fonts.regular, fontSize, width);
  for (let i = 0; i < wordLines.length; i++) {
    const words = wordLines[i];
    const isLastLine = i === wordLines.length - 1;
    checkPage(ctx, fontSize + EU_LINE_SPACING);
    if (isLastLine || words.length <= 1) {
      ctx.page.drawText(words.join(' '), { x, y: ctx.y, size: fontSize, font: ctx.fonts.regular, color });
    } else {
      drawJustifiedWordsOnPage(ctx.page, words, x, ctx.y, fontSize, ctx.fonts.regular, color, width);
    }
    ctx.y -= (fontSize + EU_LINE_SPACING);
  }
}

function drawTextBlock(ctx: PdfCtx, text: string, x: number, width: number, font: PDFFont, fontSize: number, color = EU_BODY_TEXT, spacing = EU_LINE_SPACING) {
  const lines = wrapText(text, font, fontSize, width);
  for (const line of lines) {
    checkPage(ctx, fontSize + spacing);
    ctx.page.drawText(line, { x, y: ctx.y, size: fontSize, font, color });
    ctx.y -= (fontSize + spacing);
  }
}

function euDrawSectionHeader(ctx: PdfCtx, title: string) {
  checkPage(ctx, 30);
  ctx.y -= EU_SECTION_GAP_BEFORE;

  ctx.page.drawText(title.toUpperCase(), {
    x: EU_MARGIN, y: ctx.y, size: EU_SECTION_SIZE,
    font: ctx.fonts.bold, color: EU_PRIMARY,
  });
  ctx.y -= 2;

  ctx.page.drawLine({
    start: { x: EU_MARGIN, y: ctx.y },
    end: { x: EU_LINE_X_END, y: ctx.y },
    thickness: 0.5,
    color: EU_PRIMARY,
  });

  ctx.y -= EU_SECTION_GAP_AFTER;
}

function euDrawBullets(ctx: PdfCtx, bullets: string[], x: number, width: number) {
  const bulletW = ctx.fonts.regular.widthOfTextAtSize(EU_BULLET_PREFIX, EU_BULLET_SIZE);
  for (const bullet of bullets) {
    checkPage(ctx, EU_BULLET_SIZE + EU_LINE_SPACING);
    ctx.page.drawText(EU_BULLET_PREFIX, {
      x, y: ctx.y, size: EU_BULLET_SIZE,
      font: ctx.fonts.regular, color: EU_BODY_TEXT,
    });
    const textWidth = width - bulletW;
    const wordLines = splitTextIntoWordLines(bullet, ctx.fonts.regular, EU_BULLET_SIZE, textWidth);
    for (let li = 0; li < wordLines.length; li++) {
      const words = wordLines[li];
      const isLast = li === wordLines.length - 1;
      checkPage(ctx, EU_BULLET_SIZE + EU_LINE_SPACING);
      const lineX = li === 0 ? x + bulletW : x;
      if (isLast || words.length <= 1) {
        ctx.page.drawText(words.join(' '), { x: lineX, y: ctx.y, size: EU_BULLET_SIZE, font: ctx.fonts.regular, color: EU_BODY_TEXT });
      } else {
        drawJustifiedWordsOnPage(ctx.page, words, lineX, ctx.y, EU_BULLET_SIZE, ctx.fonts.regular, EU_BODY_TEXT, textWidth);
      }
      ctx.y -= (EU_BULLET_SIZE + EU_LINE_SPACING);
    }
    ctx.y -= EU_ENTRY_GAP;
  }
}

function euDrawEntry(ctx: PdfCtx, dateRange: string, title: string, subtitle: string, bullets?: string[]) {
  checkPage(ctx, 50);
  const entryStartY = ctx.y;

  drawTextBlock(ctx, dateRange, EU_MARGIN, EU_LEFT_COL_WIDTH - 5,
    ctx.fonts.bold, EU_DATE_SIZE, EU_PRIMARY);

  const dateEndY = ctx.y;

  ctx.y = entryStartY;
  ctx.page.drawText(title, {
    x: EU_CONTACT_X, y: ctx.y, size: EU_TITLE_SIZE,
    font: ctx.fonts.bold, color: EU_BLACK,
  });
  ctx.y -= (EU_TITLE_SIZE + EU_LINE_SPACING);

  if (subtitle) {
    ctx.page.drawText(subtitle, {
      x: EU_CONTACT_X, y: ctx.y, size: EU_TITLE_SIZE,
      font: ctx.fonts.italic, color: EU_BLACK,
    });
    ctx.y -= (EU_TITLE_SIZE + EU_LINE_SPACING);
  }

  ctx.y = Math.min(ctx.y, dateEndY);
  ctx.y -= 2;

  if (bullets && bullets.length > 0) {
    const rightWidth = PAGE_WIDTH - EU_CONTACT_X - EU_RIGHT_MARGIN;
    euDrawBullets(ctx, bullets, EU_CONTACT_X, rightWidth);
  }
  ctx.y -= 2;
}

function euDrawEducation(ctx: PdfCtx, edu: { dateRange: string; degree: string; institution: string; grade?: string }) {
  checkPage(ctx, 40);
  const entryStartY = ctx.y;

  drawTextBlock(ctx, edu.dateRange, EU_MARGIN, EU_LEFT_COL_WIDTH - 5,
    ctx.fonts.bold, EU_DATE_SIZE, EU_PRIMARY);
  const dateEndY = ctx.y;

  ctx.y = entryStartY;
  ctx.page.drawText(edu.degree, {
    x: EU_CONTACT_X, y: ctx.y, size: EU_TITLE_SIZE,
    font: ctx.fonts.bold, color: EU_BLACK,
  });
  ctx.y -= (EU_TITLE_SIZE + EU_LINE_SPACING);

  ctx.page.drawText(edu.institution, {
    x: EU_CONTACT_X, y: ctx.y, size: EU_TITLE_SIZE,
    font: ctx.fonts.italic, color: EU_BLACK,
  });
  ctx.y -= (EU_TITLE_SIZE + EU_LINE_SPACING);

  if (edu.grade) {
    ctx.page.drawText(edu.grade, {
      x: EU_CONTACT_X, y: ctx.y, size: EU_BODY_SIZE,
      font: ctx.fonts.regular, color: EU_BODY_TEXT,
    });
    ctx.y -= (EU_BODY_SIZE + EU_LINE_SPACING);
  }

  ctx.y = Math.min(ctx.y, dateEndY);
  ctx.y -= 2;
}

async function generateEuropassPDF(cv: ParsedCV): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts = await loadFonts(doc);
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const ctx: PdfCtx = { doc, page, y: PAGE_HEIGHT - EU_MARGIN, fonts };

  // ===== HEADER =====
  ctx.page.drawText(cv.personalInfo.fullName || 'Name', {
    x: EU_MARGIN, y: ctx.y, size: EU_NAME_SIZE,
    font: fonts.bold, color: EU_PRIMARY,
  });
  ctx.y -= (EU_NAME_SIZE + 6);

  // ===== CONTACT INFO (starting at x=60mm, with labels) =====
  const contactItems: { label: string; value: string }[] = [];
  if (cv.personalInfo.location) contactItems.push({ label: 'Location: ', value: cv.personalInfo.location });
  if (cv.personalInfo.email && cv.personalInfo.phone) {
    contactItems.push({ label: 'Email: ', value: `${cv.personalInfo.email} | Phone: ${cv.personalInfo.phone}` });
  } else {
    if (cv.personalInfo.email) contactItems.push({ label: 'Email: ', value: cv.personalInfo.email });
    if (cv.personalInfo.phone) contactItems.push({ label: 'Phone: ', value: cv.personalInfo.phone });
  }
  if (cv.personalInfo.linkedin && cv.personalInfo.github) {
    contactItems.push({ label: 'LinkedIn: ', value: `${cv.personalInfo.linkedin} | GitHub: ${cv.personalInfo.github}` });
  } else {
    if (cv.personalInfo.linkedin) contactItems.push({ label: 'LinkedIn: ', value: cv.personalInfo.linkedin });
    if (cv.personalInfo.github) contactItems.push({ label: 'GitHub: ', value: cv.personalInfo.github });
  }
  if (cv.personalInfo.website) contactItems.push({ label: 'Website: ', value: cv.personalInfo.website });

  for (const item of contactItems) {
    checkPage(ctx, EU_CONTACT_SIZE + 2);
    const labelWidth = fonts.regular.widthOfTextAtSize(item.label, EU_CONTACT_SIZE);
    ctx.page.drawText(item.label, {
      x: EU_CONTACT_X, y: ctx.y, size: EU_CONTACT_SIZE,
      font: fonts.regular, color: EU_BLACK,
    });
    ctx.page.drawText(item.value, {
      x: EU_CONTACT_X + labelWidth, y: ctx.y, size: EU_CONTACT_SIZE,
      font: fonts.regular, color: EU_BLACK,
    });
    ctx.y -= (EU_CONTACT_SIZE + 2);
  }

  ctx.y -= 4;

  // ===== PERSONAL STATEMENT =====
  if (cv.personalStatement) {
    euDrawSectionHeader(ctx, 'Personal Statement');
    // Full-width justified block (as in Europass reference)
    const stmtWidth = PAGE_WIDTH - EU_MARGIN - EU_RIGHT_MARGIN;
    drawJustifiedBlock(ctx, cv.personalStatement, EU_MARGIN, stmtWidth, EU_BODY_SIZE);
    ctx.y -= 4;
  }

  // ===== TECHNICAL PORTFOLIO & PROJECTS (before Work Experience, per Europass standard) =====
  if (cv.projects && cv.projects.length > 0) {
    euDrawSectionHeader(ctx, 'Technical Portfolio & Projects');
    for (const proj of cv.projects) {
      // Two-column layout: category on left, title+description on right
      checkPage(ctx, 40);
      const entryStartY = ctx.y;

      // Left column: category label in bold blue
      drawTextBlock(ctx, proj.category || '', EU_MARGIN, EU_LEFT_COL_WIDTH - 5,
        ctx.fonts.bold, EU_DATE_SIZE, EU_PRIMARY);

      const dateEndY = ctx.y;

      // Right column: project title (bold) + description (justified)
      ctx.y = entryStartY;
      ctx.page.drawText(proj.title || '', {
        x: EU_CONTACT_X, y: ctx.y, size: EU_TITLE_SIZE,
        font: ctx.fonts.bold, color: EU_BLACK,
      });
      ctx.y -= (EU_TITLE_SIZE + EU_LINE_SPACING);

      ctx.y = Math.min(ctx.y, dateEndY);
      ctx.y -= 2;

      if (proj.description) {
        const rightWidth = PAGE_WIDTH - EU_CONTACT_X - EU_RIGHT_MARGIN;
        drawJustifiedBlock(ctx, proj.description, EU_CONTACT_X, rightWidth, EU_BODY_SIZE);
      }
      ctx.y -= 2;
    }
  }

  // ===== WORK EXPERIENCE =====
  if (cv.workExperience && cv.workExperience.length > 0) {
    euDrawSectionHeader(ctx, 'Work Experience');
    for (const exp of cv.workExperience) {
      euDrawEntry(ctx, exp.dateRange || '', exp.title || '', exp.subtitle || '', exp.bullets);
    }
  }

  // ===== EDUCATION =====
  if (cv.education && cv.education.length > 0) {
    euDrawSectionHeader(ctx, 'Education');
    for (const edu of cv.education) {
      euDrawEducation(ctx, edu);
    }
  }

  // ===== TECHNICAL MASTERY (Skills) =====
  if (cv.skills && cv.skills.length > 0) {
    euDrawSectionHeader(ctx, 'Technical Mastery');
    for (const group of cv.skills) {
      // Two-column layout matching Europass: category left, description right
      checkPage(ctx, 40);
      const entryStartY = ctx.y;

      // Left column: skill category name in bold blue
      drawTextBlock(ctx, group.category || '', EU_MARGIN, EU_LEFT_COL_WIDTH - 5,
        ctx.fonts.bold, EU_DATE_SIZE, EU_PRIMARY);

      const dateEndY = ctx.y;

      // Right column: skills list (justified)
      const rightWidth = PAGE_WIDTH - EU_CONTACT_X - EU_RIGHT_MARGIN;
      ctx.y = entryStartY;
      drawJustifiedBlock(ctx, group.skills, EU_CONTACT_X, rightWidth, EU_BODY_SIZE);

      // Use the minimum y between left and right column
      ctx.y = Math.min(ctx.y, dateEndY);
      ctx.y -= 2;
    }
  }

  return doc.save();
}

// ===================================================================
// ATS-FRIENDLY FORMAT
// ===================================================================

async function generateATSPDF(cv: ParsedCV): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts = await loadFonts(doc);

  const margin = 72;
  const contentWidth = PAGE_WIDTH - 2 * margin;
  const black = rgb(0, 0, 0);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - margin;

  function checkSpace(needed: number) {
    if (y - needed < margin) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - margin;
    }
  }

  function drawWrapped(text: string, fontSize: number, font: PDFFont = fonts.regular, color = black, indent = 0) {
    const lines = wrapText(text, font, fontSize, contentWidth - indent);
    for (const line of lines) {
      checkSpace(fontSize + PRO_LINE_SPACING);
      page.drawText(line, { x: margin + indent, y, size: fontSize, font, color });
      y -= (fontSize + PRO_LINE_SPACING);
    }
  }

  function drawWrappedBlock(text: string, fontSize: number, font: PDFFont = fonts.regular, color = black, gap = 0) {
    if (!text) return;
    drawWrapped(text, fontSize, font, color);
    if (gap > 0) y -= gap;
  }

  function drawBullets(bullets: string[]) {
    const bw = fonts.regular.widthOfTextAtSize('\u2022  ', 10);
    const textWidth = contentWidth - bw;
    for (const bullet of bullets) {
      checkSpace(14);
      page.drawText('\u2022', { x: margin, y, size: 10, font: fonts.regular, color: black });
      const wordLines = splitTextIntoWordLines(bullet, fonts.regular, 10, textWidth);
      for (let li = 0; li < wordLines.length; li++) {
        const words = wordLines[li];
        const isLast = li === wordLines.length - 1;
        checkSpace(10 + PRO_LINE_SPACING);
        if (isLast || words.length <= 1) {
          page.drawText(words.join(' '), { x: margin + bw, y, size: 10, font: fonts.regular, color: black });
        } else {
          drawJustifiedWordsOnPage(page, words, margin + bw, y, 10, fonts.regular, black, textWidth);
        }
        y -= (10 + PRO_LINE_SPACING);
      }
      y -= 2;
    }
  }

  function drawJustified(text: string, fontSize: number, font: PDFFont = fonts.regular, color = black, indent = 0) {
    if (!text) return;
    const w = contentWidth - indent;
    const wordLines = splitTextIntoWordLines(text, font, fontSize, w);
    for (let i = 0; i < wordLines.length; i++) {
      const words = wordLines[i];
      const isLast = i === wordLines.length - 1;
      checkSpace(fontSize + PRO_LINE_SPACING);
      if (isLast || words.length <= 1) {
        page.drawText(words.join(' '), { x: margin + indent, y, size: fontSize, font, color });
      } else {
        drawJustifiedWordsOnPage(page, words, margin + indent, y, fontSize, font, color, w);
      }
      y -= (fontSize + PRO_LINE_SPACING);
    }
  }

  function drawSectionHeader(title: string) {
    checkSpace(28);
    y -= 8;
    page.drawText(title.toUpperCase(), { x: margin, y, size: 12, font: fonts.bold, color: black });
    y -= 4;
    page.drawLine({
      start: { x: margin, y }, end: { x: margin + contentWidth, y },
      thickness: 0.5, color: black,
    });
    y -= PRO_SECTION_HEADER_GAP;
  }

  // Name
  checkSpace(30);
  page.drawText(cv.personalInfo.fullName || 'Name', { x: margin, y, size: 16, font: fonts.bold, color: black });
  y -= 22;

  drawWrapped(buildContactParts(cv.personalInfo).join(' | '), 9);
  y -= 10;

  if (cv.personalStatement) {
    drawSectionHeader('Professional Summary');
    drawJustified(cv.personalStatement, 10);
    y -= 4;
  }

  if (cv.workExperience && cv.workExperience.length > 0) {
    drawSectionHeader('Professional Experience');
    for (const exp of cv.workExperience) {
      checkSpace(20);
      drawWrappedBlock(exp.title || '', 11, fonts.bold, black, 1);
      if (exp.subtitle) drawWrappedBlock(exp.subtitle, 10, fonts.italic, black, 1);
      if (exp.dateRange) drawWrappedBlock(exp.dateRange, 10, fonts.regular, black, 1);
      y -= 2;
      if (exp.bullets && exp.bullets.length > 0) drawBullets(exp.bullets);
      y -= PRO_ENTRY_GAP;
    }
  }

  if (cv.education && cv.education.length > 0) {
    drawSectionHeader('Education');
    for (const edu of cv.education) {
      checkSpace(20);
      drawWrappedBlock(edu.degree || '', 11, fonts.bold, black, 1);
      if (edu.institution) drawWrappedBlock(edu.institution, 10, fonts.italic, black, 1);
      if (edu.dateRange) drawWrappedBlock(edu.dateRange, 10, fonts.regular, black, 1);
      if (edu.grade) drawWrappedBlock(edu.grade, 10, fonts.regular, black, 1);
      y -= PRO_ENTRY_GAP;
    }
  }

  if (cv.skills && cv.skills.length > 0) {
    drawSectionHeader('Skills');
    for (const skill of cv.skills) {
      drawJustified(`${skill.category}: ${skill.skills}`, 10, fonts.regular, black);
      y -= 4;
    }
  }

  return doc.save();
}

// ===================================================================
// MODERN PROFESSIONAL FORMAT
// ===================================================================

async function generateModernPDF(cv: ParsedCV): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts = await loadFonts(doc);

  const SIDEBAR_W = 40 * MM;
  const SIDEBAR_COLOR = rgb(0, 51 / 255, 153 / 255);
  const WHITE = rgb(1, 1, 1);
  const DARK_TEXT = rgb(0.15, 0.15, 0.15);
  const GRAY_TEXT = rgb(0.4, 0.4, 0.4);
  const DIVIDER = rgb(0.85, 0.85, 0.85);
  const MARGIN_TOP = 50;
  const MAIN_LEFT = SIDEBAR_W + 22;
  const MAIN_RIGHT = PAGE_WIDTH - 30;
  const MAIN_WIDTH = MAIN_RIGHT - MAIN_LEFT;

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN_TOP;

  function drawSidebar(pg: PDFPage) {
    pg.drawRectangle({ x: 0, y: 0, width: SIDEBAR_W, height: PAGE_HEIGHT, color: SIDEBAR_COLOR });
  }

  function checkSpace(needed: number) {
    if (y - needed < MARGIN_TOP) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawSidebar(page);
      y = PAGE_HEIGHT - MARGIN_TOP;
    }
  }

  function drawBullets(bullets: string[]) {
    const bw = fonts.regular.widthOfTextAtSize('\u2022  ', 10);
    const textWidth = MAIN_WIDTH - bw;
    for (const bullet of bullets) {
      checkSpace(14);
      page.drawText('\u2022', { x: MAIN_LEFT, y, size: 10, font: fonts.regular, color: DARK_TEXT });
      const wordLines = splitTextIntoWordLines(bullet, fonts.regular, 10, textWidth);
      for (let li = 0; li < wordLines.length; li++) {
        const words = wordLines[li];
        const isLast = li === wordLines.length - 1;
        checkSpace(13);
        if (isLast || words.length <= 1) {
          page.drawText(words.join(' '), { x: MAIN_LEFT + bw, y, size: 10, font: fonts.regular, color: DARK_TEXT });
        } else {
          drawJustifiedWordsOnPage(page, words, MAIN_LEFT + bw, y, 10, fonts.regular, DARK_TEXT, textWidth);
        }
        y -= 13;
      }
      y -= 2;
    }
  }

  function drawJustified(text: string, fontSize: number, font: PDFFont = fonts.regular, color = DARK_TEXT) {
    if (!text) return;
    const wordLines = splitTextIntoWordLines(text, font, fontSize, MAIN_WIDTH);
    for (let i = 0; i < wordLines.length; i++) {
      const words = wordLines[i];
      const isLast = i === wordLines.length - 1;
      checkSpace(fontSize + PRO_LINE_SPACING);
      if (isLast || words.length <= 1) {
        page.drawText(words.join(' '), { x: MAIN_LEFT, y, size: fontSize, font, color });
      } else {
        drawJustifiedWordsOnPage(page, words, MAIN_LEFT, y, fontSize, font, color, MAIN_WIDTH);
      }
      y -= (fontSize + PRO_LINE_SPACING);
    }
  }

  function drawSectionHeader(title: string) {
    checkSpace(28);
    y -= 4;
    page.drawText(title.toUpperCase(), { x: MAIN_LEFT, y, size: 13, font: fonts.bold, color: DARK_TEXT });
    y -= 4;
    page.drawLine({
      start: { x: MAIN_LEFT, y }, end: { x: MAIN_RIGHT, y },
      thickness: 1, color: DARK_TEXT,
    });
    y -= PRO_SECTION_HEADER_GAP;
  }

  function drawMainWrapped(text: string, fontSize: number, font: PDFFont = fonts.regular, color = DARK_TEXT, gap = 0) {
    if (!text) return;
    const lines = wrapText(text, font, fontSize, MAIN_WIDTH);
    for (const line of lines) {
      checkSpace(fontSize + PRO_LINE_SPACING);
      page.drawText(line, { x: MAIN_LEFT, y, size: fontSize, font, color });
      y -= (fontSize + PRO_LINE_SPACING);
    }
    if (gap > 0) y -= gap;
  }

  drawSidebar(page);

  // ---- SIDEBAR CONTENT ----
  let sy = PAGE_HEIGHT - 50;

  function sidebarText(text: string, fontSize: number, font: PDFFont = fonts.regular) {
    const sbWidth = SIDEBAR_W - 30;
    const lines = wrapText(text, font, fontSize, sbWidth);
    for (const line of lines) {
      page.drawText(line, { x: 15, y: sy, size: fontSize, font, color: WHITE });
      sy -= (fontSize + 3);
    }
  }

  sidebarText(cv.personalInfo.fullName || 'Name', 14, fonts.bold);
  sy -= 6;

  page.drawLine({ start: { x: 15, y: sy }, end: { x: SIDEBAR_W - 15, y: sy }, thickness: 0.5, color: rgb(0.5, 0.5, 0.8) });
  sy -= 12;

  const contactItems = [cv.personalInfo.email, cv.personalInfo.phone, cv.personalInfo.location, cv.personalInfo.linkedin, cv.personalInfo.github, cv.personalInfo.website].filter((v): v is string => Boolean(v));
  for (const item of contactItems) {
    sidebarText(item, 8.5);
    sy -= 5;
  }

  sy -= 8;
  page.drawLine({ start: { x: 15, y: sy }, end: { x: SIDEBAR_W - 15, y: sy }, thickness: 0.5, color: rgb(0.5, 0.5, 0.8) });
  sy -= 12;

  page.drawText('SKILLS', { x: 15, y: sy, size: 10, font: fonts.bold, color: WHITE });
  sy -= 14;

  if (cv.skills && cv.skills.length > 0) {
    for (const skill of cv.skills) {
      page.drawText(skill.category, { x: 15, y: sy, size: 8.5, font: fonts.bold, color: WHITE });
      sy -= 12;
      sidebarText(skill.skills, 8);
      sy -= 8;
    }
  }

  // ---- MAIN CONTENT ----
  checkSpace(35);
  const nameLines = wrapText(cv.personalInfo.fullName || 'Name', fonts.bold, 24, MAIN_WIDTH);
  for (const line of nameLines) {
    checkSpace(28);
    page.drawText(line, { x: MAIN_LEFT, y, size: 24, font: fonts.bold, color: DARK_TEXT });
    y -= 28;
  }
  y -= 2;

  checkSpace(10);
  y -= 5;
  page.drawLine({ start: { x: MAIN_LEFT, y }, end: { x: MAIN_RIGHT, y }, thickness: 0.75, color: DIVIDER });
  y -= 12;

  if (cv.personalStatement) {
    drawSectionHeader('About Me');
    drawJustified(cv.personalStatement, 10, fonts.italic);
    y -= 4;
  }

  if (cv.workExperience && cv.workExperience.length > 0) {
    drawSectionHeader('Work Experience');
    for (const exp of cv.workExperience) {
      checkSpace(20);
      drawMainWrapped(exp.title || '', 11, fonts.bold, DARK_TEXT, 1);
      if (exp.subtitle) drawMainWrapped(exp.subtitle, 10, fonts.italic, DARK_TEXT, 1);
      if (exp.dateRange) drawMainWrapped(exp.dateRange, 9, fonts.regular, GRAY_TEXT, 1);
      y -= 2;
      if (exp.bullets && exp.bullets.length > 0) drawBullets(exp.bullets);
      y -= PRO_ENTRY_GAP;
    }
  }

  if (cv.education && cv.education.length > 0) {
    drawSectionHeader('Education');
    for (const edu of cv.education) {
      checkSpace(20);
      drawMainWrapped(edu.degree || '', 11, fonts.bold, DARK_TEXT, 1);
      if (edu.institution) drawMainWrapped(edu.institution, 10, fonts.italic, DARK_TEXT, 1);
      if (edu.dateRange) drawMainWrapped(edu.dateRange, 9, fonts.regular, GRAY_TEXT, 1);
      if (edu.grade) drawMainWrapped(edu.grade || '', 10, fonts.regular, DARK_TEXT, 1);
      y -= PRO_ENTRY_GAP;
    }
  }

  if (cv.projects && cv.projects.length > 0) {
    drawSectionHeader('Projects');
    for (const proj of cv.projects) {
      checkSpace(20);
      const label = proj.category ? `[${proj.category}] ` : '';
      drawMainWrapped(`${label}${proj.title || ''}`, 10, fonts.bold, DARK_TEXT, 1);
      if (proj.description) drawJustified(proj.description, 9);
      y -= 4;
    }
  }

  return doc.save();
}

// ===================================================================
// CREATIVE BOLD FORMAT
// ===================================================================

async function generateCreativePDF(cv: ParsedCV): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts = await loadFonts(doc);

  const PURPLE = rgb(0x53 / 255, 0x3a / 255, 0xfd / 255);
  const WHITE = rgb(1, 1, 1);
  const DARK = rgb(0.12, 0.12, 0.12);
  const GRAY = rgb(0.4, 0.4, 0.4);

  const HEADER_H = 90;
  const margin = 50;
  const contentWidth = PAGE_WIDTH - 2 * margin;
  const LEFT_COL_W = 115;
  const CONTENT_START = margin + LEFT_COL_W + 10;
  const CONTENT_W = contentWidth - LEFT_COL_W - 10;

  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  page.drawRectangle({
    x: 0, y: PAGE_HEIGHT - HEADER_H,
    width: PAGE_WIDTH, height: HEADER_H,
    color: PURPLE,
  });

  const nameText = cv.personalInfo.fullName || 'Name';
  const nameWidth = fonts.bold.widthOfTextAtSize(nameText, 22);
  page.drawText(nameText, {
    x: (PAGE_WIDTH - nameWidth) / 2, y: PAGE_HEIGHT - 38,
    size: 22, font: fonts.bold, color: WHITE,
  });

  const contactText = buildContactParts(cv.personalInfo).join('  |  ');
  const contactLines = wrapText(contactText, fonts.regular, 9, PAGE_WIDTH - 80);
  let cy = PAGE_HEIGHT - 58;
  for (const line of contactLines) {
    const lw = fonts.regular.widthOfTextAtSize(line, 9);
    page.drawText(line, {
      x: (PAGE_WIDTH - lw) / 2, y: cy,
      size: 9, font: fonts.regular, color: WHITE,
    });
    cy -= 12;
  }

  let y = PAGE_HEIGHT - HEADER_H - margin;

  // Track pages for multi-page support
  let currentPage = page;

  function ensureSpace(needed: number) {
    if (y - needed < margin) {
      currentPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - margin;
    }
  }

  function drawSectionHeader(title: string) {
    ensureSpace(30);
    y -= 8;
    currentPage.drawRectangle({
      x: margin, y: y + 1, width: 4, height: 12,
      color: PURPLE,
    });
    currentPage.drawText(title.toUpperCase(), {
      x: margin + 10, y, size: 13, font: fonts.bold, color: PURPLE,
    });
    y -= 3;
    currentPage.drawLine({
      start: { x: margin, y }, end: { x: margin + contentWidth, y },
      thickness: 1, color: PURPLE,
    });
    y -= 14;
  }

  function drawJustifiedOnCurrent(text: string, fontSize: number, font: PDFFont = fonts.regular, color = DARK, maxWidth = contentWidth, startX = margin) {
    if (!text) return;
    const wordLines = splitTextIntoWordLines(text, font, fontSize, maxWidth);
    for (let i = 0; i < wordLines.length; i++) {
      const words = wordLines[i];
      const isLast = i === wordLines.length - 1;
      ensureSpace(fontSize + PRO_LINE_SPACING);
      if (isLast || words.length <= 1) {
        currentPage.drawText(words.join(' '), { x: startX, y, size: fontSize, font, color });
      } else {
        drawJustifiedWordsOnPage(currentPage, words, startX, y, fontSize, font, color, maxWidth);
      }
      y -= (fontSize + PRO_LINE_SPACING);
    }
  }

  function drawWrappedOnCurrent(text: string, fontSize: number, font: PDFFont, color: ReturnType<typeof rgb>, maxWidth: number, startX: number, gap = 0) {
    if (!text) return;
    const lines = wrapText(text, font, fontSize, maxWidth);
    for (const line of lines) {
      ensureSpace(fontSize + PRO_LINE_SPACING);
      currentPage.drawText(line, { x: startX, y, size: fontSize, font, color });
      y -= (fontSize + PRO_LINE_SPACING);
    }
    if (gap > 0) y -= gap;
  }

  if (cv.personalStatement) {
    drawSectionHeader('Profile');
    drawJustifiedOnCurrent(cv.personalStatement, 10, fonts.italic);
    y -= 4;
  }

  if (cv.workExperience && cv.workExperience.length > 0) {
    drawSectionHeader('Experience');
    for (const exp of cv.workExperience) {
      ensureSpace(20);
      const entryStartY = y;

      if (exp.dateRange) {
        const dateLines = wrapText(exp.dateRange, fonts.bold, 9, LEFT_COL_W);
        for (const dl of dateLines) {
          currentPage.drawText(dl, { x: margin, y, size: 9, font: fonts.bold, color: PURPLE });
          y -= 12;
        }
      }
      const afterDateY = y;

      y = entryStartY;
      drawWrappedOnCurrent(exp.title || '', 11, fonts.bold, DARK, CONTENT_W, CONTENT_START, 1);
      if (exp.subtitle) {
        drawWrappedOnCurrent(exp.subtitle, 10, fonts.italic, GRAY, CONTENT_W, CONTENT_START, 1);
      }
      y = Math.min(y, afterDateY);
      y -= 3;

      if (exp.bullets && exp.bullets.length > 0) {
        const bw = fonts.regular.widthOfTextAtSize('\u2022  ', 10);
        const textWidth = CONTENT_W - bw;
        for (const bullet of exp.bullets) {
          ensureSpace(14);
          currentPage.drawText('\u2022', { x: CONTENT_START, y, size: 10, font: fonts.regular, color: PURPLE });
          const wordLines = splitTextIntoWordLines(bullet, fonts.regular, 10, textWidth);
          for (let li = 0; li < wordLines.length; li++) {
            const words = wordLines[li];
            const isLast = li === wordLines.length - 1;
            ensureSpace(13);
            if (isLast || words.length <= 1) {
              currentPage.drawText(words.join(' '), { x: CONTENT_START + bw, y, size: 10, font: fonts.regular, color: DARK });
            } else {
              drawJustifiedWordsOnPage(currentPage, words, CONTENT_START + bw, y, 10, fonts.regular, DARK, textWidth);
            }
            y -= 13;
          }
          y -= 2;
        }
      }
      y -= PRO_ENTRY_GAP;
    }
  }

  if (cv.education && cv.education.length > 0) {
    drawSectionHeader('Education');
    for (const edu of cv.education) {
      ensureSpace(20);
      const entryStartY = y;
      if (edu.dateRange) {
        currentPage.drawText(edu.dateRange, { x: margin, y, size: 9, font: fonts.bold, color: PURPLE });
        y -= 12;
      }
      const afterDateY = y;

      y = entryStartY;
      drawWrappedOnCurrent(edu.degree || '', 11, fonts.bold, DARK, CONTENT_W, CONTENT_START, 1);
      if (edu.institution) {
        drawWrappedOnCurrent(edu.institution, 10, fonts.italic, GRAY, CONTENT_W, CONTENT_START, 1);
      }
      if (edu.grade) {
        drawWrappedOnCurrent(edu.grade || '', 10, fonts.regular, DARK, CONTENT_W, CONTENT_START, 1);
      }
      y = Math.min(y, afterDateY);
      y -= PRO_ENTRY_GAP;
    }
  }

  if (cv.projects && cv.projects.length > 0) {
    drawSectionHeader('Projects');
    for (const proj of cv.projects) {
      ensureSpace(20);
      const label = proj.category ? `[${proj.category}] ` : '';
      drawWrappedOnCurrent(`${label}${proj.title || ''}`, 10, fonts.bold, DARK, contentWidth, margin, 1);
      if (proj.description) drawJustifiedOnCurrent(proj.description, 9);
      y -= 4;
    }
  }

  if (cv.skills && cv.skills.length > 0) {
    drawSectionHeader('Skills');
    for (const skill of cv.skills) {
      ensureSpace(14);
      currentPage.drawText(skill.category, { x: margin, y, size: 10, font: fonts.bold, color: PURPLE });
      y -= 14;
      const skillsList = skill.skills.split(',').map(s => s.trim()).filter(Boolean);
      let currentLine = '';
      for (const sk of skillsList) {
        const test = currentLine ? `${currentLine}, ${sk}` : sk;
        const tw = fonts.regular.widthOfTextAtSize(`\u2022  ${test}`, 10);
        if (tw > contentWidth && currentLine) {
          ensureSpace(14);
          currentPage.drawText('\u2022', { x: margin, y, size: 10, font: fonts.regular, color: PURPLE });
          const bw = fonts.regular.widthOfTextAtSize('\u2022  ', 10);
          currentPage.drawText(currentLine, { x: margin + bw, y, size: 10, font: fonts.regular, color: DARK });
          y -= 14;
          currentLine = sk;
        } else {
          currentLine = test;
        }
      }
      if (currentLine) {
        ensureSpace(14);
        currentPage.drawText('\u2022', { x: margin, y, size: 10, font: fonts.regular, color: PURPLE });
        const bw = fonts.regular.widthOfTextAtSize('\u2022  ', 10);
        currentPage.drawText(currentLine, { x: margin + bw, y, size: 10, font: fonts.regular, color: DARK });
        y -= 14;
      }
      y -= 4;
    }
  }

  return doc.save();
}

// ===================================================================
// CLASSIC TRADITIONAL FORMAT
// ===================================================================

async function generateClassicPDF(cv: ParsedCV): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts = await loadFonts(doc);

  const margin = 72;
  const contentWidth = PAGE_WIDTH - 2 * margin;
  const DARK = rgb(0.1, 0.1, 0.1);
  const MEDIUM = rgb(0.3, 0.3, 0.3);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - margin;

  function checkSpace(needed: number) {
    if (y - needed < margin) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - margin;
    }
  }

  function centerDraw(text: string, yPos: number, fontSize: number, font: PDFFont, color = DARK) {
    const tw = font.widthOfTextAtSize(text, fontSize);
    page.drawText(text, { x: (PAGE_WIDTH - tw) / 2, y: yPos, size: fontSize, font, color });
  }

  function drawBullets(bullets: string[]) {
    const bw = fonts.regular.widthOfTextAtSize('\u2013  ', 10);
    const textWidth = contentWidth - bw;
    for (const bullet of bullets) {
      checkSpace(15);
      page.drawText('\u2013', { x: margin, y, size: 10, font: fonts.regular, color: DARK });
      const wordLines = splitTextIntoWordLines(bullet, fonts.regular, 10, textWidth);
      for (let li = 0; li < wordLines.length; li++) {
        const words = wordLines[li];
        const isLast = li === wordLines.length - 1;
        checkSpace(14);
        if (isLast || words.length <= 1) {
          page.drawText(words.join(' '), { x: margin + bw, y, size: 10, font: fonts.regular, color: DARK });
        } else {
          drawJustifiedWordsOnPage(page, words, margin + bw, y, 10, fonts.regular, DARK, textWidth);
        }
        y -= 14;
      }
      y -= 2;
    }
  }

  function drawJustified(text: string, fontSize: number, font: PDFFont = fonts.regular, color = DARK) {
    if (!text) return;
    const wordLines = splitTextIntoWordLines(text, font, fontSize, contentWidth);
    for (let i = 0; i < wordLines.length; i++) {
      const words = wordLines[i];
      const isLast = i === wordLines.length - 1;
      checkSpace(fontSize + PRO_LINE_SPACING);
      if (isLast || words.length <= 1) {
        page.drawText(words.join(' '), { x: margin, y, size: fontSize, font, color });
      } else {
        drawJustifiedWordsOnPage(page, words, margin, y, fontSize, font, color, contentWidth);
      }
      y -= (fontSize + PRO_LINE_SPACING);
    }
  }

  function drawWrappedClassic(text: string, fontSize: number, font: PDFFont, color = DARK, gap = 0) {
    if (!text) return;
    const lines = wrapText(text, font, fontSize, contentWidth);
    for (const line of lines) {
      checkSpace(fontSize + PRO_LINE_SPACING);
      page.drawText(line, { x: margin, y, size: fontSize, font, color });
      y -= (fontSize + PRO_LINE_SPACING);
    }
    if (gap > 0) y -= gap;
  }

  function drawCenteredSectionHeader(title: string) {
    checkSpace(30);
    y -= 10;
    const tw = fonts.bold.widthOfTextAtSize(title, 12);
    const centerX = (PAGE_WIDTH - tw) / 2;
    const gap = 12;
    const lineY = y + 3;
    page.drawLine({ start: { x: margin, y: lineY }, end: { x: centerX - gap, y: lineY }, thickness: 0.75, color: MEDIUM });
    page.drawLine({ start: { x: centerX + tw + gap, y: lineY }, end: { x: PAGE_WIDTH - margin, y: lineY }, thickness: 0.75, color: MEDIUM });
    page.drawText(title, { x: centerX, y, size: 12, font: fonts.bold, color: DARK });
    y -= 16;
  }

  // Header
  checkSpace(60);
  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: PAGE_WIDTH - margin, y }, thickness: 1, color: DARK });
  y -= 18;
  centerDraw(cv.personalInfo.fullName || 'Name', y, 20, fonts.bold, DARK);
  y -= 26;
  page.drawLine({ start: { x: margin, y }, end: { x: PAGE_WIDTH - margin, y }, thickness: 1, color: DARK });
  y -= 18;

  const contactLines = wrapText(buildContactParts(cv.personalInfo).join('  |  '), fonts.regular, 9, contentWidth);
  for (const line of contactLines) {
    const lw = fonts.regular.widthOfTextAtSize(line, 9);
    page.drawText(line, { x: (PAGE_WIDTH - lw) / 2, y, size: 9, font: fonts.regular, color: MEDIUM });
    y -= 12;
  }
  y -= 10;

  if (cv.personalStatement) {
    drawCenteredSectionHeader('Professional Summary');
    drawJustified(cv.personalStatement, 10, fonts.italic);
    y -= 4;
  }

  if (cv.workExperience && cv.workExperience.length > 0) {
    drawCenteredSectionHeader('Professional Experience');
    for (const exp of cv.workExperience) {
      checkSpace(20);
      drawWrappedClassic(exp.title || '', 11, fonts.bold, DARK, 1);
      if (exp.subtitle) drawWrappedClassic(exp.subtitle, 10, fonts.italic, MEDIUM, 1);
      if (exp.dateRange) drawWrappedClassic(exp.dateRange, 9, fonts.regular, MEDIUM, 1);
      y -= 2;
      if (exp.bullets && exp.bullets.length > 0) drawBullets(exp.bullets);
      y -= PRO_ENTRY_GAP;
    }
  }

  if (cv.education && cv.education.length > 0) {
    drawCenteredSectionHeader('Education');
    for (const edu of cv.education) {
      checkSpace(20);
      drawWrappedClassic(edu.degree || '', 11, fonts.bold, DARK, 1);
      if (edu.institution) drawWrappedClassic(edu.institution, 10, fonts.italic, MEDIUM, 1);
      if (edu.dateRange) drawWrappedClassic(edu.dateRange, 9, fonts.regular, MEDIUM, 1);
      if (edu.grade) drawWrappedClassic(edu.grade || '', 10, fonts.regular, DARK, 1);
      y -= PRO_ENTRY_GAP;
    }
  }

  if (cv.projects && cv.projects.length > 0) {
    drawCenteredSectionHeader('Projects');
    for (const proj of cv.projects) {
      checkSpace(20);
      const label = proj.category ? `${proj.category}: ` : '';
      drawWrappedClassic(`${label}${proj.title || ''}`, 10, fonts.bold, DARK, 1);
      if (proj.description) drawJustified(proj.description, 10);
      y -= 4;
    }
  }

  if (cv.skills && cv.skills.length > 0) {
    drawCenteredSectionHeader('Skills');
    for (const skill of cv.skills) {
      drawJustified(`${skill.category}: ${skill.skills}`, 10, fonts.regular, DARK);
      y -= 4;
    }
  }

  return doc.save();
}

// ===== POST HANDLER =====
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cvData, format } = body;

    if (!cvData || !cvData.personalInfo) {
      return NextResponse.json(
        { success: false, error: 'cvData with personalInfo is required' },
        { status: 400 }
      );
    }

    const cv: ParsedCV = sanitizeParsedCV(cvData as ParsedCV);
    const fmt: CVFormatId = format || 'europass';

    let pdfBytes: Uint8Array;

    switch (fmt) {
      case 'ats':
        pdfBytes = await generateATSPDF(cv);
        break;
      case 'modern':
        pdfBytes = await generateModernPDF(cv);
        break;
      case 'creative':
        pdfBytes = await generateCreativePDF(cv);
        break;
      case 'classic':
        pdfBytes = await generateClassicPDF(cv);
        break;
      case 'europass':
      default:
        pdfBytes = await generateEuropassPDF(cv);
        break;
    }

    return new NextResponse(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${(cv.personalInfo.fullName || 'CV').replace(/\s+/g, '_')}_${fmt}_CV.pdf"`,
        'Content-Length': pdfBytes.length.toString(),
      },
    });
  } catch (error: unknown) {
    console.error('Generate PDF error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred while generating PDF';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
