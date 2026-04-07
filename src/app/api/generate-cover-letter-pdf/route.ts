import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, PDFFont, StandardFonts } from 'pdf-lib';
import type { CoverLetterData, CoverLetterFormatId } from '@/lib/cv-types';
import { sanitizeCoverLetterData } from '@/lib/text-cleaning';
import {
  splitTextIntoLines, splitTextIntoWordLines,
  PAGE_WIDTH, PAGE_HEIGHT, embedNotoSansFont,
} from '@/lib/pdf-utils';

// ===== FONT LOADING =====

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
}

async function loadFonts(doc: PDFDocument): Promise<Fonts> {
  try {
    const regular = await embedNotoSansFont(doc, 'NotoSans-Regular.ttf');
    const bold = await embedNotoSansFont(doc, 'NotoSans-Bold.ttf');
    const italic = await embedNotoSansFont(doc, 'NotoSans-Italic.ttf');
    return { regular, bold, italic };
  } catch (err) {
    console.warn('[generate-cover-letter-pdf] Noto fonts unavailable, falling back to standard PDF fonts:', err instanceof Error ? err.message : err);
    const [regular, bold, italic] = await Promise.all([
      doc.embedFont(StandardFonts.Helvetica),
      doc.embedFont(StandardFonts.HelveticaBold),
      doc.embedFont(StandardFonts.HelveticaOblique),
    ]);
    return { regular, bold, italic };
  }
}

const CL_TOP_MARGIN = 60;
const CL_MIN_MARGIN = 54;
const CL_LINE_TIGHT = 3;
const CL_LINE_NORMAL = 4;
const CL_LINE_LOOSE = 5;
const CL_PARAGRAPH_GAP = 8;

// ===== PROFESSIONAL BUSINESS LETTER =====

async function generateProfessionalPDF(cl: CoverLetterData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts = await loadFonts(doc);

  const MM_TO_PT = 2.835;
  const LEFT_MARGIN = 25 * MM_TO_PT;
  const RIGHT_MARGIN = 15 * MM_TO_PT;
  const contentWidth = PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN;
  const textColor = rgb(0.1, 0.1, 0.1);
  const grayColor = rgb(0.3, 0.3, 0.3);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - CL_TOP_MARGIN;

  function checkSpace(needed: number) {
    if (y - needed < CL_MIN_MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - CL_TOP_MARGIN;
    }
  }

  // Page-break-aware justified drawing
  function drawJustified(text: string, fontSize: number, lineSpacing = CL_LINE_LOOSE) {
    if (!text) return;
    const wordLines = splitTextIntoWordLines(text, fonts.regular, fontSize, contentWidth);
    for (let i = 0; i < wordLines.length; i++) {
      const words = wordLines[i];
      const isLast = i === wordLines.length - 1;
      checkSpace(fontSize + lineSpacing);
      if (isLast || words.length <= 1) {
        page.drawText(words.join(' '), { x: LEFT_MARGIN, y, size: fontSize, font: fonts.regular, color: textColor });
      } else {
        const wordWidths = words.map(w => fonts.regular.widthOfTextAtSize(w, fontSize));
        const totalWW = wordWidths.reduce((a, b) => a + b, 0);
        const gap = (contentWidth - totalWW) / (words.length - 1);
        let cx = LEFT_MARGIN;
        for (let j = 0; j < words.length; j++) {
          page.drawText(words[j], { x: cx, y, size: fontSize, font: fonts.regular, color: textColor });
          cx += wordWidths[j] + (j < words.length - 1 ? gap : 0);
        }
      }
      y -= (fontSize + lineSpacing);
    }
  }

  // Page-break-aware left-aligned drawing
  function drawText(text: string, fontSize: number, font: PDFFont = fonts.regular, color = textColor, ls = CL_LINE_NORMAL) {
    const lines = splitTextIntoLines(text, font, fontSize, contentWidth);
    for (const line of lines) {
      checkSpace(fontSize + ls);
      page.drawText(line, { x: LEFT_MARGIN, y, size: fontSize, font, color });
      y -= (fontSize + ls);
    }
  }

  // --- Sender info (top-left) ---
  checkSpace(20);
  page.drawText(cl.applicantName || 'Applicant', {
    x: LEFT_MARGIN, y, size: 14, font: fonts.bold, color: textColor,
  });
  y -= 18;
  drawText(cl.applicantContact || '', 10, fonts.regular, grayColor, 3);
  y -= CL_PARAGRAPH_GAP;

  // --- Date ---
  checkSpace(14);
  drawText(cl.date || '', 11, fonts.regular, grayColor, 4);
  y -= CL_PARAGRAPH_GAP;

  // --- Recipient info ---
  if (cl.recipientName) drawText(cl.recipientName, 11, fonts.bold, textColor, 4);
  if (cl.recipientTitle) drawText(cl.recipientTitle, 11, fonts.regular, textColor, 4);
  if (cl.companyAddress) {
    const addrLines = cl.companyAddress.split('\n');
    for (const addrLine of addrLines) {
      drawText(addrLine.trim(), 11, fonts.regular, textColor, 4);
    }
  }

  y -= CL_PARAGRAPH_GAP;

  // --- Greeting ---
  if (cl.greeting) {
    drawText(cl.greeting, 11, fonts.regular, textColor, 4);
    y -= CL_LINE_NORMAL;
  }

  // --- Body paragraphs (justified) ---
  drawJustified(cl.openingParagraph || '', 11, 5);
  y -= CL_PARAGRAPH_GAP;

  if (cl.bodyParagraphs && cl.bodyParagraphs.length > 0) {
    for (const para of cl.bodyParagraphs) {
      drawJustified(para, 11, 5);
      y -= CL_PARAGRAPH_GAP;
    }
  }

  drawJustified(cl.closingParagraph || '', 11, 5);
  y -= CL_PARAGRAPH_GAP;

  // --- Sign-off ---
  drawText(cl.signOff || '', 11);
  y -= 4;
  drawText(cl.applicantName || '', 12, fonts.bold, textColor, 4);

  return doc.save();
}

// ===== MODERN FORMAT =====

async function generateModernPDF(cl: CoverLetterData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts = await loadFonts(doc);

  const margin = CL_TOP_MARGIN;
  const contentWidth = PAGE_WIDTH - 2 * margin;
  const textColor = rgb(0.12, 0.12, 0.12);
  const grayColor = rgb(0.35, 0.35, 0.35);
  const accentColor = rgb(0.2, 0.2, 0.2);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - margin;

  function checkSpace(needed: number) {
    if (y - needed < margin) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - margin;
    }
  }

  function drawJustified(text: string, fontSize: number, lineSpacing = CL_LINE_NORMAL) {
    if (!text) return;
    const wordLines = splitTextIntoWordLines(text, fonts.regular, fontSize, contentWidth);
    for (let i = 0; i < wordLines.length; i++) {
      const words = wordLines[i];
      const isLast = i === wordLines.length - 1;
      checkSpace(fontSize + lineSpacing);
      if (isLast || words.length <= 1) {
        page.drawText(words.join(' '), { x: margin, y, size: fontSize, font: fonts.regular, color: textColor });
      } else {
        const wordWidths = words.map(w => fonts.regular.widthOfTextAtSize(w, fontSize));
        const totalWW = wordWidths.reduce((a, b) => a + b, 0);
        const gap = (contentWidth - totalWW) / (words.length - 1);
        let cx = margin;
        for (let j = 0; j < words.length; j++) {
          page.drawText(words[j], { x: cx, y, size: fontSize, font: fonts.regular, color: textColor });
          cx += wordWidths[j] + (j < words.length - 1 ? gap : 0);
        }
      }
      y -= (fontSize + lineSpacing);
    }
  }

  function drawText(text: string, fontSize: number, font: PDFFont = fonts.regular, color = textColor, ls = CL_LINE_TIGHT) {
    const lines = splitTextIntoLines(text, font, fontSize, contentWidth);
    for (const line of lines) {
      checkSpace(fontSize + ls);
      page.drawText(line, { x: margin, y, size: fontSize, font, color });
      y -= (fontSize + ls);
    }
  }

  // Sender name large
  checkSpace(24);
  page.drawText(cl.applicantName || 'Applicant', {
    x: margin, y, size: 18, font: fonts.bold, color: textColor,
  });
  y -= 22;

  // Contact
  drawText(cl.applicantContact || '', 10, fonts.regular, grayColor, 3);
  y -= 6;

  // Divider
  checkSpace(6);
  page.drawLine({
    start: { x: margin, y }, end: { x: PAGE_WIDTH - margin, y },
    thickness: 0.75, color: grayColor,
  });
  y -= 16;

  // Date
  drawText(cl.date || '', 11, fonts.regular, grayColor, 3);
  y -= 10;

  // Recipient
  if (cl.recipientName) drawText(cl.recipientName, 11, fonts.bold, textColor, 3);
  if (cl.recipientTitle) drawText(cl.recipientTitle, 11, fonts.regular, textColor, 3);
  if (cl.companyAddress) {
    for (const addrLine of cl.companyAddress.split('\n')) {
      drawText(addrLine.trim(), 11, fonts.regular, textColor, 3);
    }
  }

  y -= 12;

  if (cl.greeting) {
    drawText(cl.greeting, 11);
    y -= 4;
  }

  drawJustified(cl.openingParagraph || '', 11, 4);
  y -= CL_PARAGRAPH_GAP;

  if (cl.bodyParagraphs && cl.bodyParagraphs.length > 0) {
    for (const para of cl.bodyParagraphs) {
      drawJustified(para, 11, 4);
      y -= CL_PARAGRAPH_GAP;
    }
  }

  drawJustified(cl.closingParagraph || '', 11, 4);
  y -= 16;

  drawText(cl.signOff || '', 11);
  y -= 4;
  drawText(cl.applicantName || '', 12, fonts.bold, textColor, 3);

  // Accent line under name
  checkSpace(6);
  const nameWidth = fonts.bold.widthOfTextAtSize(cl.applicantName || '', 12);
  page.drawLine({
    start: { x: margin, y }, end: { x: margin + nameWidth, y },
    thickness: 2, color: accentColor,
  });

  return doc.save();
}

// ===== CREATIVE FORMAT =====

async function generateCreativePDF(cl: CoverLetterData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts = await loadFonts(doc);

  const PURPLE = rgb(0x53 / 255, 0x3a / 255, 0xfd / 255);
  const WHITE = rgb(1, 1, 1);
  const textColor = rgb(0.12, 0.12, 0.12);
  const grayColor = rgb(0.35, 0.35, 0.35);

  const HEADER_HEIGHT = 40;
  const margin = Math.max(70, CL_MIN_MARGIN);
  const contentWidth = PAGE_WIDTH - 2 * margin;

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  page.drawRectangle({
    x: 0, y: PAGE_HEIGHT - HEADER_HEIGHT,
    width: PAGE_WIDTH, height: HEADER_HEIGHT,
    color: PURPLE,
  });

  const nameText = cl.applicantName || 'Applicant';
  const nameWidth = fonts.bold.widthOfTextAtSize(nameText, 16);
  page.drawText(nameText, {
    x: (PAGE_WIDTH - nameWidth) / 2, y: PAGE_HEIGHT - 28,
    size: 16, font: fonts.bold, color: WHITE,
  });

  let y = PAGE_HEIGHT - HEADER_HEIGHT - 30;

  function checkSpace(needed: number) {
    if (y - needed < margin) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - margin;
    }
  }

  function drawJustified(text: string, fontSize: number, lineSpacing = CL_LINE_NORMAL) {
    if (!text) return;
    const wordLines = splitTextIntoWordLines(text, fonts.regular, fontSize, contentWidth);
    for (let i = 0; i < wordLines.length; i++) {
      const words = wordLines[i];
      const isLast = i === wordLines.length - 1;
      checkSpace(fontSize + lineSpacing);
      if (isLast || words.length <= 1) {
        page.drawText(words.join(' '), { x: margin, y, size: fontSize, font: fonts.regular, color: textColor });
      } else {
        const wordWidths = words.map(w => fonts.regular.widthOfTextAtSize(w, fontSize));
        const totalWW = wordWidths.reduce((a, b) => a + b, 0);
        const gap = (contentWidth - totalWW) / (words.length - 1);
        let cx = margin;
        for (let j = 0; j < words.length; j++) {
          page.drawText(words[j], { x: cx, y, size: fontSize, font: fonts.regular, color: textColor });
          cx += wordWidths[j] + (j < words.length - 1 ? gap : 0);
        }
      }
      y -= (fontSize + lineSpacing);
    }
  }

  function drawText(text: string, fontSize: number, font: PDFFont = fonts.regular, color = textColor, ls = CL_LINE_TIGHT) {
    const lines = splitTextIntoLines(text, font, fontSize, contentWidth);
    for (const line of lines) {
      checkSpace(fontSize + ls);
      page.drawText(line, { x: margin, y, size: fontSize, font, color });
      y -= (fontSize + ls);
    }
  }

  // Contact centered below header
  const contactText = cl.applicantContact || '';
  const contactLines = splitTextIntoLines(contactText, fonts.regular, 10, contentWidth);
  for (const line of contactLines) {
    const lw = fonts.regular.widthOfTextAtSize(line, 10);
    page.drawText(line, {
      x: (PAGE_WIDTH - lw) / 2, y, size: 10, font: fonts.regular, color: grayColor,
    });
    y -= 13;
  }

  y -= 4;
  drawText(cl.date || '', 10.5, fonts.regular, grayColor, 3);
  y -= 8;

  if (cl.recipientName) drawText(cl.recipientName, 10.5, fonts.regular, textColor, 3);
  if (cl.recipientTitle) drawText(cl.recipientTitle, 10.5, fonts.regular, textColor, 3);
  if (cl.companyAddress) {
    for (const addrLine of cl.companyAddress.split('\n')) {
      drawText(addrLine.trim(), 10.5, fonts.regular, textColor, 3);
    }
  }

  y -= 12;

  if (cl.greeting) {
    drawText(cl.greeting, 10.5);
    y -= 4;
  }

  drawJustified(cl.openingParagraph || '', 11, 4);
  y -= 8;

  if (cl.bodyParagraphs && cl.bodyParagraphs.length > 0) {
    for (const para of cl.bodyParagraphs) {
      drawJustified(para, 10.5, CL_LINE_TIGHT);
      y -= CL_PARAGRAPH_GAP;
    }
  }

  drawJustified(cl.closingParagraph || '', 10.5, 4);
  y -= 14;

  // Colored divider before closing
  checkSpace(6);
  page.drawLine({
    start: { x: margin, y }, end: { x: margin + 60, y },
    thickness: 2, color: PURPLE,
  });
  y -= 12;

  drawText(cl.signOff || '', 10.5);
  y -= 4;
  drawText(cl.applicantName || '', 11, fonts.bold, textColor, 3);

  return doc.save();
}

// ===== CONCISE FORMAT =====

async function generateConcisePDF(cl: CoverLetterData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts = await loadFonts(doc);

  const margin = CL_MIN_MARGIN;
  const contentWidth = PAGE_WIDTH - 2 * margin;
  const textColor = rgb(0.12, 0.12, 0.12);
  const grayColor = rgb(0.3, 0.3, 0.3);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - margin;

  function checkSpace(needed: number) {
    if (y - needed < margin) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - margin;
    }
  }

  function drawJustified(text: string, fontSize: number, lineSpacing = CL_LINE_TIGHT) {
    if (!text) return;
    const wordLines = splitTextIntoWordLines(text, fonts.regular, fontSize, contentWidth);
    for (let i = 0; i < wordLines.length; i++) {
      const words = wordLines[i];
      const isLast = i === wordLines.length - 1;
      checkSpace(fontSize + lineSpacing);
      if (isLast || words.length <= 1) {
        page.drawText(words.join(' '), { x: margin, y, size: fontSize, font: fonts.regular, color: textColor });
      } else {
        const wordWidths = words.map(w => fonts.regular.widthOfTextAtSize(w, fontSize));
        const totalWW = wordWidths.reduce((a, b) => a + b, 0);
        const gap = (contentWidth - totalWW) / (words.length - 1);
        let cx = margin;
        for (let j = 0; j < words.length; j++) {
          page.drawText(words[j], { x: cx, y, size: fontSize, font: fonts.regular, color: textColor });
          cx += wordWidths[j] + (j < words.length - 1 ? gap : 0);
        }
      }
      y -= (fontSize + lineSpacing);
    }
  }

  function drawText(text: string, fontSize: number, font: PDFFont = fonts.regular, color = textColor, ls = CL_LINE_TIGHT) {
    const lines = splitTextIntoLines(text, font, fontSize, contentWidth);
    for (const line of lines) {
      checkSpace(fontSize + ls);
      page.drawText(line, { x: margin, y, size: fontSize, font, color });
      y -= (fontSize + ls);
    }
  }

  checkSpace(16);
  page.drawText(cl.applicantName || 'Applicant', {
    x: margin, y, size: 12, font: fonts.bold, color: textColor,
  });
  y -= 13;

  drawText(cl.applicantContact || '', 9.5, fonts.regular, grayColor, 2);
  y -= 2;
  drawText(cl.date || '', 9.5, fonts.regular, grayColor, 2);
  y -= 4;

  if (cl.recipientName) drawText(cl.recipientName, 9.5);
  if (cl.recipientTitle) drawText(cl.recipientTitle, 9.5);
  if (cl.companyAddress) {
    for (const addrLine of cl.companyAddress.split('\n')) {
      drawText(addrLine.trim(), 9.5);
    }
  }

  y -= 6;

  if (cl.greeting) {
    drawText(cl.greeting, 9.5);
    y -= 2;
  }

  drawJustified(cl.openingParagraph || '', 10.5, 3);
  y -= 4;

  if (cl.bodyParagraphs && cl.bodyParagraphs.length > 0) {
    for (const para of cl.bodyParagraphs) {
      drawJustified(para, 10.5, 3);
      y -= 4;
    }
  }

  drawJustified(cl.closingParagraph || '', 10.5, 3);
  y -= 10;

  drawText(cl.signOff || '', 10.5);
  y -= 2;
  drawText(cl.applicantName || '', 10.5, fonts.bold, textColor, 2);

  return doc.save();
}

// ===== FORMAL FORMAT =====

async function generateFormalPDF(cl: CoverLetterData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts = await loadFonts(doc);

  const margin = 72;
  const contentWidth = PAGE_WIDTH - 2 * margin;
  const textColor = rgb(0.1, 0.1, 0.1);
  const grayColor = rgb(0.25, 0.25, 0.25);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - margin;

  function checkSpace(needed: number) {
    if (y - needed < margin) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - margin;
    }
  }

  function centerDraw(text: string, yPos: number, fontSize: number, font: PDFFont, color = textColor) {
    const tw = font.widthOfTextAtSize(text, fontSize);
    page.drawText(text, { x: (PAGE_WIDTH - tw) / 2, y: yPos, size: fontSize, font, color });
  }

  function drawJustified(text: string, fontSize: number, lineSpacing = CL_LINE_LOOSE) {
    if (!text) return;
    const wordLines = splitTextIntoWordLines(text, fonts.regular, fontSize, contentWidth);
    for (let i = 0; i < wordLines.length; i++) {
      const words = wordLines[i];
      const isLast = i === wordLines.length - 1;
      checkSpace(fontSize + lineSpacing);
      if (isLast || words.length <= 1) {
        page.drawText(words.join(' '), { x: margin, y, size: fontSize, font: fonts.regular, color: textColor });
      } else {
        const wordWidths = words.map(w => fonts.regular.widthOfTextAtSize(w, fontSize));
        const totalWW = wordWidths.reduce((a, b) => a + b, 0);
        const gap = (contentWidth - totalWW) / (words.length - 1);
        let cx = margin;
        for (let j = 0; j < words.length; j++) {
          page.drawText(words[j], { x: cx, y, size: fontSize, font: fonts.regular, color: textColor });
          cx += wordWidths[j] + (j < words.length - 1 ? gap : 0);
        }
      }
      y -= (fontSize + lineSpacing);
    }
  }

  function drawText(text: string, fontSize: number, font: PDFFont = fonts.regular, color = textColor, ls = CL_LINE_NORMAL) {
    const lines = splitTextIntoLines(text, font, fontSize, contentWidth);
    for (const line of lines) {
      checkSpace(fontSize + ls);
      page.drawText(line, { x: margin, y, size: fontSize, font, color });
      y -= (fontSize + ls);
    }
  }

  // Centered sender name with horizontal rules
  checkSpace(50);
  y -= 8;
  page.drawLine({ start: { x: margin, y }, end: { x: PAGE_WIDTH - margin, y }, thickness: 1.5, color: textColor });
  y -= 20;
  centerDraw(cl.applicantName || 'Applicant', y, 16, fonts.bold, textColor);
  y -= 22;
  page.drawLine({ start: { x: margin, y }, end: { x: PAGE_WIDTH - margin, y }, thickness: 1.5, color: textColor });
  y -= 20;

  // Contact centered
  const contactText = cl.applicantContact || '';
  const contactLines = splitTextIntoLines(contactText, fonts.regular, 10, contentWidth);
  for (const line of contactLines) {
    checkSpace(14);
    const lw = fonts.regular.widthOfTextAtSize(line, 10);
    page.drawText(line, { x: (PAGE_WIDTH - lw) / 2, y, size: 10, font: fonts.regular, color: grayColor });
    y -= 14;
  }
  y -= 8;

  // Date
  drawText(cl.date || '', 12, fonts.regular, grayColor, 4);
  y -= 10;

  // Recipient
  if (cl.recipientName) drawText(cl.recipientName, 12);
  if (cl.recipientTitle) drawText(cl.recipientTitle, 12);
  if (cl.companyAddress) {
    for (const addrLine of cl.companyAddress.split('\n')) {
      drawText(addrLine.trim(), 12);
    }
  }

  y -= 16;

  if (cl.greeting) {
    drawText(cl.greeting, 12);
    y -= 8;
  }

  drawJustified(cl.openingParagraph || '', 12, 5);
  y -= 8;

  if (cl.bodyParagraphs && cl.bodyParagraphs.length > 0) {
    for (const para of cl.bodyParagraphs) {
      drawJustified(para, 12, 5);
      y -= 8;
    }
  }

  drawJustified(cl.closingParagraph || '', 12, 5);
  y -= 18;

  drawText(cl.signOff || '', 12);
  y -= 4;

  // Space for signature
  checkSpace(40);
  y -= 30;

  drawText(cl.applicantName || '', 12, fonts.bold, textColor);

  return doc.save();
}

// ===== POST HANDLER =====

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { coverLetter, formatId } = body as {
      coverLetter: CoverLetterData;
      formatId: CoverLetterFormatId;
    };

    if (!coverLetter || typeof coverLetter !== 'object') {
      return NextResponse.json(
        { success: false, error: 'coverLetter is required and must be an object' },
        { status: 400 }
      );
    }

    if (!formatId || typeof formatId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'formatId is required and must be a string' },
        { status: 400 }
      );
    }

    const validFormats: CoverLetterFormatId[] = ['professional', 'modern', 'creative', 'concise', 'formal'];
    if (!validFormats.includes(formatId)) {
      return NextResponse.json(
        { success: false, error: `Invalid formatId: ${formatId}` },
        { status: 400 }
      );
    }

    const cleanCoverLetter = sanitizeCoverLetterData(coverLetter);

    let pdfBytes: Uint8Array;
    switch (formatId) {
      case 'professional':
        pdfBytes = await generateProfessionalPDF(cleanCoverLetter);
        break;
      case 'modern':
        pdfBytes = await generateModernPDF(cleanCoverLetter);
        break;
      case 'creative':
        pdfBytes = await generateCreativePDF(cleanCoverLetter);
        break;
      case 'concise':
        pdfBytes = await generateConcisePDF(cleanCoverLetter);
        break;
      case 'formal':
        pdfBytes = await generateFormalPDF(cleanCoverLetter);
        break;
      default:
        return NextResponse.json(
          { success: false, error: `Unsupported format: ${formatId}` },
          { status: 400 }
        );
    }

    const safeName = (cleanCoverLetter.applicantName || 'Applicant')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .toLowerCase();
    const filename = `${safeName}_${formatId}_cover_letter.pdf`;

    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);

    return new NextResponse(pdfBytes as unknown as BodyInit, { headers });
  } catch (error: unknown) {
    console.error('[generate-cover-letter-pdf] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
