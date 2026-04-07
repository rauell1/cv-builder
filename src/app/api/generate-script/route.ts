import { NextRequest, NextResponse } from 'next/server';
import type { ParsedCV } from '@/lib/cv-types';
import { escapePythonString } from '@/lib/pdf-utils';

/**
 * Sanitize user-controlled strings for safe embedding in JS template literals.
 * Prevents Server-Side Template Injection by escaping `${` sequences.
 */
function safeTemplateStr(str: string): string {
  // First escape for Python, then escape JS template literal injection
  return escapePythonString(str).replace(/\$\{/g, '\\$\\{');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cvData } = body;

    if (!cvData || !cvData.personalInfo) {
      return NextResponse.json(
        { success: false, error: 'cvData with personalInfo is required' },
        { status: 400 }
      );
    }

    const cv: ParsedCV = cvData;
    const pi = cv.personalInfo;

    // Build the fpdf2 Python script with the tailored CV data
    const script = `#!/usr/bin/env python3
"""
Europass CV Generator - AI CV Builder
Generated Python script using fpdf2 library.
Run in Google Colab or any Python environment with fpdf2 installed.
"""

# Install dependencies
!pip install fpdf2 -q

# Download fonts
!wget -nc https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf -q
!wget -nc https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf -q
!wget -nc https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Italic.ttf -q
!wget -nc https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-BoldItalic.ttf -q

from fpdf import FPDF
from google.colab import files


class EuropassCV(FPDF):
    def __init__(self, orientation='P', unit='mm', format='A4'):
        super().__init__(orientation, unit, format)
        self.add_font('NotoSans', '', 'NotoSans-Regular.ttf', uni=True)
        self.add_font('NotoSans', 'B', 'NotoSans-Bold.ttf', uni=True)
        self.add_font('NotoSans', 'I', 'NotoSans-Italic.ttf', uni=True)
        self.add_font('NotoSans', 'BI', 'NotoSans-BoldItalic.ttf', uni=True)
        self.set_margins(15, 15, 15)
        self.set_auto_page_break(auto=True, margin=15)

    def section_header(self, title):
        self.set_left_margin(15)
        self.set_right_margin(15)
        self.set_x(15)
        self.ln(4)
        self.set_font('NotoSans', 'B', 12)
        self.set_text_color(0, 51, 153)
        self.cell(0, 6, title.upper(), border=0, ln=1, align='L')
        self.set_draw_color(0, 51, 153)
        self.set_line_width(0.5)
        self.line(15, self.get_y(), 195, self.get_y())
        self.ln(4)

    def entry_head(self, left_col_text, title, subtitle=""):
        y_start = self.get_y()

        # Left Column
        self.set_left_margin(15)
        self.set_x(15)
        self.set_font('NotoSans', 'B', 9)
        self.set_text_color(0, 51, 153)
        self.multi_cell(40, 5, left_col_text, border=0, align='L')
        y_left_end = self.get_y()

        # Right Column
        self.set_left_margin(60)
        self.set_right_margin(15)
        self.set_xy(60, y_start)

        self.set_font('NotoSans', 'B', 10)
        self.set_text_color(0, 0, 0)
        self.multi_cell(0, 5, title, border=0, align='L')

        if subtitle:
            self.set_x(60)
            self.set_font('NotoSans', 'I', 10)
            self.multi_cell(0, 5, subtitle, border=0, align='L')

        self.ln(1)
        self.set_y(max(self.get_y(), y_left_end))
        self.set_left_margin(15)

    def body(self, text, bullet=False):
        self.set_left_margin(60)
        self.set_right_margin(15)
        self.set_x(60)

        self.set_font('NotoSans', '', 9)
        self.set_text_color(30, 30, 30)
        prefix = "\\u2022  " if bullet else ""

        self.multi_cell(0, 5, f"{prefix}{text}", align='J')

        self.ln(1.5)
        self.set_left_margin(15)


# Initialize PDF
pdf = EuropassCV()
pdf.add_page()

# --- HEADER ---
pdf.set_left_margin(15)
pdf.set_x(15)
pdf.set_font('NotoSans', 'B', 18)
pdf.set_text_color(0, 51, 153)
pdf.cell(0, 10, '${safeTemplateStr(pi.fullName)}', 0, 1)

pdf.set_left_margin(60)
pdf.set_right_margin(15)
pdf.set_x(60)
pdf.set_font('NotoSans', '', 9)
pdf.set_text_color(0, 0, 0)
${pi.location ? `pdf.cell(0, 5, "Location: ${safeTemplateStr(pi.location)}", 0, 1)` : ''}
${pi.email ? `pdf.cell(0, 5, "Email: ${safeTemplateStr(pi.email)}${pi.phone ? ` | Phone: ${safeTemplateStr(pi.phone)}` : ''}", 0, 1)` : (pi.phone ? `pdf.cell(0, 5, "Phone: ${safeTemplateStr(pi.phone)}", 0, 1)` : '')}
${pi.linkedin ? `pdf.cell(0, 5, "LinkedIn: ${safeTemplateStr(pi.linkedin)}${pi.github ? ` | GitHub: ${safeTemplateStr(pi.github)}` : ''}", 0, 1)` : (pi.github ? `pdf.cell(0, 5, "GitHub: ${safeTemplateStr(pi.github)}", 0, 1)` : '')}
pdf.set_left_margin(15)

# --- PERSONAL STATEMENT ---
pdf.section_header("PERSONAL STATEMENT")
pdf.body("${safeTemplateStr(cv.personalStatement || '')}")

${cv.workExperience.length > 0 ? `# --- WORK EXPERIENCE ---
pdf.section_header("WORK EXPERIENCE")
${cv.workExperience.map(exp => `pdf.entry_head("${safeTemplateStr(exp.dateRange)}", "${safeTemplateStr(exp.title)}", "${safeTemplateStr(exp.subtitle)}")
${exp.bullets.map(b => `pdf.body("${safeTemplateStr(b)}", bullet=True)`).join('\n')}`).join('\n\n')}` : '// No work experience entries'}

${cv.education.length > 0 ? `# --- EDUCATION ---
pdf.section_header("EDUCATION")
${cv.education.map(edu => `pdf.entry_head("${safeTemplateStr(edu.dateRange)}", "${safeTemplateStr(edu.degree)}", "${safeTemplateStr(edu.institution)}")
${edu.grade ? `pdf.body("${safeTemplateStr(edu.grade)}")` : ''}`).join('\n\n')}` : '// No education entries'}

${cv.projects.length > 0 ? `# --- PROJECTS ---
pdf.section_header("TECHNICAL PORTFOLIO & PROJECTS")
${cv.projects.map(proj => `pdf.entry_head("${safeTemplateStr(proj.category)}", "${safeTemplateStr(proj.title)}")
pdf.body("${safeTemplateStr(proj.description)}")`).join('\n\n')}` : '// No project entries'}

${cv.skills.length > 0 ? `# --- SKILLS ---
pdf.section_header("TECHNICAL MASTERY")
${cv.skills.map(skill => `pdf.entry_head("${safeTemplateStr(skill.category)}", "")
pdf.body("${safeTemplateStr(skill.skills)}")`).join('\n\n')}` : '// No skills entries'}

# --- FILE EXPORT ---
filename = "${safeTemplateStr(pi.fullName || 'CV').replace(/\s+/g, '_')}_RESUME.pdf"
pdf.output(filename)
files.download(filename)
`;

    return new NextResponse(script, {
      status: 200,
      headers: {
        'Content-Type': 'text/x-python',
        'Content-Disposition': `attachment; filename="${(pi.fullName || 'cv').replace(/\s+/g, '_')}_europass_generator.py"`,
      },
    });
  } catch (error: unknown) {
    console.error('Generate script error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
