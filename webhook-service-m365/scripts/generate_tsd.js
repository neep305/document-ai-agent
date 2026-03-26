#!/usr/bin/env node
/**
 * generate_tsd.js — Convert TSD Agent markdown output to a formatted .docx file.
 * Matches the AA_3_TechSpec_WebSDK template format.
 *
 * Input  (stdin): JSON { "clientName": "...", "markdown": "...", "javascript": "..." }
 * Output (stdout): JSON { "success": true, "base64": "<docx base64>" }
 * On error: JSON { "success": false, "error": "<message>" }
 */

'use strict';

/**
 * Strip XML 1.0 invalid control characters (all C0 except \t \n \r, plus \x0B \x0C).
 * DOCX is XML — these chars cause "not well-formed" parse errors in Word.
 */
function sanitizeXml(str) {
    if (typeof str !== 'string') return String(str ?? '');
    // Remove: 0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F, 0xFFFE, 0xFFFF
    return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g, '');
}

const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
    ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
    TableOfContents, BookmarkStart, BookmarkEnd, InternalHyperlink,
    UnderlineType,
} = require('docx');

// ── Color Palette ─────────────────────────────────────────────────────────────

const ADOBE_BLUE      = '1473E6';  // Primary Adobe blue (headers, headings)
const ADOBE_BLUE_DARK = '0D4DA1';  // Darker blue (cover)
const ADOBE_BLUE_LIGHT = 'EBF5FF'; // Light blue (table row alt)
const TABLE_HEADER_BG  = '1473E6'; // Table header background
const TABLE_HEADER_FG  = 'FFFFFF'; // Table header text (white)
const CODE_BG          = 'F5F5F5'; // Code block background
const CODE_BORDER      = '1473E6'; // Code block left border
const BORDER_GRAY      = 'D1D1D1'; // General cell border
const TEXT_DARK        = '2C2C2C'; // Body text
const TEXT_GRAY        = '6E6E6E'; // Muted / subtitle
const TEXT_WHITE       = 'FFFFFF'; // White text
const CTRL_ROW_BG      = 'EBF5FF'; // Document control label bg
const ROW_ALT          = 'F8FBFF'; // Alternating row

// A4 page: width=11906, margins 1"=1440 each side → content=11906-2880=9026
const PAGE_W       = 11906;
const PAGE_H       = 16838;
const MARGIN       = 1440;
const CONTENT_W    = PAGE_W - MARGIN * 2; // 9026

// ── Cell Border Helpers ───────────────────────────────────────────────────────

const border1 = (color = BORDER_GRAY) => ({ style: BorderStyle.SINGLE, size: 4, color });
const allBorders = (color = BORDER_GRAY) => ({
    top: border1(color), bottom: border1(color),
    left: border1(color), right: border1(color),
});
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

// ── Inline Markdown Parser ───────────────────────────────────────────────────

/**
 * Parse inline markdown (bold, italic, inline code) into TextRun array.
 */
function parseInline(rawText, baseOpts = {}) {
    const text = sanitizeXml(String(rawText ?? ''));
    const runs = [];
    // Pattern order: **bold**, *italic*, `code`
    const pattern = /\*\*([^*]+?)\*\*|\*([^*]+?)\*|`([^`]+?)`/g;
    let lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
            const plain = text.slice(lastIndex, match.index);
            if (plain) runs.push(new TextRun({ text: plain, ...baseOpts }));
        }
        if (match[1] !== undefined) {
            runs.push(new TextRun({ text: match[1], bold: true, ...baseOpts }));
        } else if (match[2] !== undefined) {
            runs.push(new TextRun({ text: match[2], italics: true, ...baseOpts }));
        } else if (match[3] !== undefined) {
            runs.push(new TextRun({
                text: match[3],
                font: 'Courier New',
                size: (baseOpts.size || 20) - 2,
                color: '333333',
                shading: { type: ShadingType.CLEAR, fill: 'EEEEEE' },
                ...baseOpts,
            }));
        }
        lastIndex = pattern.lastIndex;
    }
    if (lastIndex < text.length) {
        const tail = text.slice(lastIndex);
        if (tail) runs.push(new TextRun({ text: tail, ...baseOpts }));
    }
    if (runs.length === 0) runs.push(new TextRun({ text: '', ...baseOpts }));
    return runs;
}

// ── Markdown → AST ───────────────────────────────────────────────────────────

/**
 * Parse the TSD markdown into a structured AST.
 * Handles: ## section, ### subsection, #### sub-subsection,
 *          pipe tables, ```code```, bullet lists (- / *), blank lines, text.
 */
function parseMarkdown(md) {
    const lines = md.split('\n');
    const doc = { title: '', sections: [] };
    let currentSection = null;
    let currentSub     = null;
    let currentSubSub  = null;
    let inCode         = false;
    let codeLang       = '';
    let codeLines      = [];
    let tableLines     = [];
    let textLines      = [];
    let bulletItems    = [];

    function target() {
        return currentSubSub || currentSub || currentSection;
    }

    function push(node) {
        const t = target();
        if (t) t.children.push(node);
    }

    function flushText() {
        const text = textLines.join('\n').trim();
        if (text) push({ type: 'text', text });
        textLines = [];
    }

    function flushTable() {
        if (!tableLines.length) return;
        const table = parseTable(tableLines);
        if (table) push({ type: 'table', table });
        tableLines = [];
    }

    function flushBullets() {
        if (!bulletItems.length) return;
        push({ type: 'bullets', items: [...bulletItems] });
        bulletItems = [];
    }

    for (const line of lines) {
        // ── Code block ──
        if (inCode) {
            if (line.trimStart().startsWith('```')) {
                push({ type: 'code', lang: codeLang, code: codeLines.join('\n') });
                inCode = false; codeLines = []; codeLang = '';
            } else {
                codeLines.push(line);
            }
            continue;
        }

        if (line.trimStart().startsWith('```')) {
            flushTable(); flushBullets(); flushText();
            inCode = true;
            codeLang = line.trim().slice(3).trim();
            continue;
        }

        // ── Headings ──
        if (line.startsWith('# ')) {
            doc.title = line.slice(2).trim();
            continue;
        }

        if (line.startsWith('## ')) {
            flushTable(); flushBullets(); flushText();
            currentSubSub = null;
            currentSub    = null;
            currentSection = { type: 'section', title: line.slice(3).trim(), children: [] };
            doc.sections.push(currentSection);
            continue;
        }

        if (line.startsWith('### ')) {
            flushTable(); flushBullets(); flushText();
            currentSubSub = null;
            currentSub = { type: 'subsection', title: line.slice(4).trim(), children: [] };
            if (currentSection) currentSection.children.push(currentSub);
            continue;
        }

        if (line.startsWith('#### ')) {
            flushTable(); flushBullets(); flushText();
            currentSubSub = { type: 'subsubsection', title: line.slice(5).trim(), children: [] };
            if (currentSub) currentSub.children.push(currentSubSub);
            else if (currentSection) currentSection.children.push(currentSubSub);
            continue;
        }

        // ── Horizontal rule ──
        if (/^---+$/.test(line.trim())) {
            flushTable(); flushBullets(); flushText();
            continue;
        }

        // ── Table ──
        if (line.trimStart().startsWith('|')) {
            flushBullets(); flushText();
            tableLines.push(line);
            continue;
        }
        if (tableLines.length && !line.trimStart().startsWith('|')) {
            flushTable();
        }

        // ── Bullets ──
        const bulletMatch = line.match(/^(\s*)[*\-]\s+(.+)/);
        if (bulletMatch) {
            flushText();
            bulletItems.push(bulletMatch[2]);
            continue;
        }
        if (bulletItems.length && line.trim() && !line.match(/^(\s*)[*\-]\s+/)) {
            flushBullets();
        }

        textLines.push(line);
    }

    flushTable();
    flushBullets();
    flushText();
    if (inCode && codeLines.length) push({ type: 'code', lang: codeLang, code: codeLines.join('\n') });

    return doc;
}

function parseTable(lines) {
    const rows = [];
    for (const line of lines) {
        const trimmed = line.trim();
        // Skip separator rows like |---|---|
        if (/^\|[\s\-:|]+\|$/.test(trimmed)) continue;
        const cells = trimmed.split('|').slice(1, -1).map(c => c.trim());
        if (cells.length) rows.push(cells);
    }
    if (!rows.length) return null;
    return { headers: rows[0], rows: rows.slice(1) };
}

// ── docx Element Builders ────────────────────────────────────────────────────

function makeTableCell(text, {
    header = false, width = null, shade = null, bold = null,
    align = AlignmentType.LEFT, fontSize = 18, color = null,
} = {}) {
    const isHeader = header;
    const fillColor = shade || (isHeader ? TABLE_HEADER_BG : null);
    const textColor = color || (isHeader ? TABLE_HEADER_FG : TEXT_DARK);
    const isBold    = bold !== null ? bold : isHeader;

    return new TableCell({
        borders: allBorders(),
        width: width ? { size: width, type: WidthType.DXA } : undefined,
        shading: fillColor ? { fill: fillColor, type: ShadingType.CLEAR } : undefined,
        margins: { top: 100, bottom: 100, left: 144, right: 144 },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
            alignment: align,
            spacing: { before: 0, after: 0 },
            children: parseInline(String(text ?? ''), {
                bold: isBold,
                font: 'Arial',
                size: fontSize,
                color: textColor,
            }),
        })],
    });
}

function buildDataTable(tableData) {
    const colCount = tableData.headers.length;
    // Distribute widths; first col slightly wider for label columns
    const colWidth = Math.floor(CONTENT_W / colCount);
    const colWidths = tableData.headers.map((_, i) =>
        i === colCount - 1 ? CONTENT_W - colWidth * (colCount - 1) : colWidth
    );

    const headerRow = new TableRow({
        tableHeader: true,
        children: tableData.headers.map((h, i) =>
            makeTableCell(h, { header: true, width: colWidths[i] })
        ),
    });

    const dataRows = tableData.rows.map((row, ri) =>
        new TableRow({
            children: tableData.headers.map((_, i) =>
                makeTableCell(row[i] ?? '', {
                    width: colWidths[i],
                    shade: ri % 2 === 1 ? ROW_ALT : null,
                    fontSize: 17,
                })
            ),
        })
    );

    return new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: colWidths,
        rows: [headerRow, ...dataRows],
    });
}

function buildTwoColCtrlTable(pairs) {
    // Used for Document Control / Version Control
    const LABEL_W = Math.floor(CONTENT_W * 0.28);
    const VALUE_W = CONTENT_W - LABEL_W;

    const rows = pairs.map((pair, ri) => {
        if (pair.length === 1) {
            // full-width header spanning 2 cols
            const label = pair[0];
            return new TableRow({
                children: [new TableCell({
                    columnSpan: 2,
                    borders: allBorders(),
                    shading: { fill: ADOBE_BLUE, type: ShadingType.CLEAR },
                    margins: { top: 80, bottom: 80, left: 144, right: 144 },
                    children: [new Paragraph({
                        children: [new TextRun({ text: label, bold: true, font: 'Arial', size: 20, color: TEXT_WHITE })],
                    })],
                })],
            });
        }
        return new TableRow({
            children: [
                makeTableCell(pair[0], {
                    width: LABEL_W,
                    shade: CTRL_ROW_BG,
                    bold: true,
                    fontSize: 18,
                    color: ADOBE_BLUE_DARK,
                }),
                makeTableCell(pair[1], {
                    width: VALUE_W,
                    shade: ri % 2 === 0 ? null : 'FAFCFF',
                    fontSize: 18,
                }),
            ],
        });
    });

    return new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [Math.floor(CONTENT_W * 0.28), CONTENT_W - Math.floor(CONTENT_W * 0.28)],
        rows,
    });
}

function buildCodeBlock(code, lang = '') {
    const header = lang
        ? [new Paragraph({
            children: [new TextRun({
                text: lang.toUpperCase(),
                font: 'Arial',
                size: 14,
                bold: true,
                color: TEXT_WHITE,
            })],
            shading: { fill: '333333', type: ShadingType.CLEAR },
            spacing: { before: 0, after: 0 },
            indent: { left: 360, right: 0 },
        })]
        : [];

    const codeParas = sanitizeXml(code).split('\n').map(line =>
        new Paragraph({
            children: [new TextRun({
                text: line || ' ',
                font: 'Courier New',
                size: 17,
                color: '1A1A1A',
            })],
            shading: { fill: CODE_BG, type: ShadingType.CLEAR },
            spacing: { before: 0, after: 0, line: 240 },
            indent: { left: 360 },
            border: {
                left: { style: BorderStyle.SINGLE, size: 16, color: CODE_BORDER },
            },
        })
    );

    const spacer = new Paragraph({ children: [], spacing: { after: 160 } });
    return [...header, ...codeParas, spacer];
}

function buildBullets(items) {
    return items.map(item =>
        new Paragraph({
            children: [
                new TextRun({ text: '• ', font: 'Arial', size: 20, color: ADOBE_BLUE }),
                ...parseInline(item, { font: 'Arial', size: 20, color: TEXT_DARK }),
            ],
            spacing: { before: 40, after: 40 },
            indent: { left: 360, hanging: 200 },
        })
    );
}

function buildTextParagraphs(text) {
    return text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line =>
            new Paragraph({
                children: parseInline(line, { font: 'Arial', size: 20, color: TEXT_DARK }),
                spacing: { before: 80, after: 80 },
            })
        );
}

function nodeToElements(node, depth = 0) {
    const elements = [];

    if (node.type === 'subsection') {
        elements.push(
            new Paragraph({
                heading: HeadingLevel.HEADING_2,
                children: [new TextRun({
                    text: node.title,
                    font: 'Arial',
                    size: 22,
                    bold: true,
                    color: '333333',
                })],
                spacing: { before: 240, after: 120 },
                border: {
                    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD', space: 4 },
                },
            })
        );
        for (const child of node.children) {
            elements.push(...nodeToElements(child, depth + 1));
        }
        return elements;
    }

    if (node.type === 'subsubsection') {
        elements.push(
            new Paragraph({
                heading: HeadingLevel.HEADING_3,
                children: [new TextRun({
                    text: node.title,
                    font: 'Arial',
                    size: 20,
                    bold: true,
                    color: '555555',
                })],
                spacing: { before: 160, after: 80 },
            })
        );
        for (const child of node.children) {
            elements.push(...nodeToElements(child, depth + 1));
        }
        return elements;
    }

    if (node.type === 'text') {
        elements.push(...buildTextParagraphs(node.text));
        return elements;
    }

    if (node.type === 'table') {
        elements.push(buildDataTable(node.table));
        elements.push(new Paragraph({ children: [], spacing: { before: 80, after: 120 } }));
        return elements;
    }

    if (node.type === 'code') {
        elements.push(...buildCodeBlock(node.code, node.lang));
        return elements;
    }

    if (node.type === 'bullets') {
        elements.push(...buildBullets(node.items));
        elements.push(new Paragraph({ children: [], spacing: { after: 80 } }));
        return elements;
    }

    return elements;
}

// ── Document Assembly ─────────────────────────────────────────────────────────

function buildDocument(parsed, clientName, javascript) {
    const now     = new Date();
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const verDate = now.toISOString().slice(0, 10);

    // ── Cover Page ──────────────────────────────────────────────────────────
    const coverChildren = [
        // Top accent bar (simulated with a thick blue paragraph border)
        new Paragraph({
            children: [],
            spacing: { before: 0, after: 0 },
            border: { top: { style: BorderStyle.SINGLE, size: 48, color: ADOBE_BLUE, space: 0 } },
        }),
        new Paragraph({ children: [], spacing: { before: 2000, after: 0 } }),

        // "Technical Solution Design" title
        new Paragraph({
            children: [new TextRun({
                text: 'Technical Solution Design',
                bold: true,
                font: 'Arial',
                size: 56,
                color: ADOBE_BLUE_DARK,
            })],
            alignment: AlignmentType.LEFT,
            spacing: { before: 0, after: 240 },
        }),

        // Client name
        new Paragraph({
            children: [new TextRun({
                text: clientName,
                font: 'Arial',
                size: 40,
                color: TEXT_DARK,
                bold: false,
            })],
            alignment: AlignmentType.LEFT,
            spacing: { after: 120 },
        }),

        // Sub-line
        new Paragraph({
            children: [new TextRun({
                text: 'Adobe Analytics — AEP Web SDK Implementation',
                font: 'Arial',
                size: 24,
                color: TEXT_GRAY,
            })],
            alignment: AlignmentType.LEFT,
            spacing: { after: 600 },
        }),

        // Horizontal divider
        new Paragraph({
            children: [],
            border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: ADOBE_BLUE, space: 4 } },
            spacing: { before: 0, after: 400 },
        }),

        // Date + Version row
        new Paragraph({
            children: [
                new TextRun({ text: 'Date: ', bold: true, font: 'Arial', size: 20, color: TEXT_GRAY }),
                new TextRun({ text: dateStr + '   ', font: 'Arial', size: 20, color: TEXT_DARK }),
                new TextRun({ text: '  Version: ', bold: true, font: 'Arial', size: 20, color: TEXT_GRAY }),
                new TextRun({ text: '1.0', font: 'Arial', size: 20, color: TEXT_DARK }),
            ],
            alignment: AlignmentType.LEFT,
        }),

        // Confidentiality note
        new Paragraph({
            children: [new TextRun({
                text: 'CONFIDENTIAL — For internal use and authorized stakeholders only.',
                font: 'Arial',
                size: 16,
                color: TEXT_GRAY,
                italics: true,
            })],
            alignment: AlignmentType.LEFT,
            spacing: { before: 200 },
        }),

        new Paragraph({ children: [new PageBreak()] }),
    ];

    // ── Document Control ────────────────────────────────────────────────────
    const docControlSection = [
        new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'Document Control', font: 'Arial', size: 32, bold: true, color: ADOBE_BLUE })],
            spacing: { before: 240, after: 200 },
        }),

        buildTwoColCtrlTable([
            ['Document Control'],
            ['Document Title',   `Technical Solution Design — ${clientName}`],
            ['Client / Company', clientName],
            ['Project',          'Adobe Analytics AEP Web SDK Implementation'],
            ['Document Type',    'Technical Specification'],
            ['Prepared By',      'Tagging AI (Document Automation System)'],
            ['Reviewed By',      ''],
            ['Approved By',      ''],
        ]),

        new Paragraph({ children: [], spacing: { before: 200, after: 0 } }),

        buildTwoColCtrlTable([
            ['Version History'],
            ['Version', '1.0'],
            ['Date',    verDate],
            ['Author',  'Tagging AI'],
            ['Changes', 'Initial release — auto-generated from SDR data'],
            ['Status',  'Draft'],
        ]),

        new Paragraph({ children: [], spacing: { before: 200, after: 0 } }),

        new Paragraph({
            children: [new TextRun({
                text: 'Notes',
                bold: true,
                font: 'Arial',
                size: 22,
                color: ADOBE_BLUE,
            })],
            spacing: { before: 280, after: 120 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD', space: 4 } },
        }),
        new Paragraph({
            children: [new TextRun({
                text: 'This document has been auto-generated by the Tagging AI document automation system '
                    + 'based on the Solution Design Reference (SDR) for ' + clientName + '. '
                    + 'All tracking specifications, data layer schemas, and Adobe Launch rule configurations '
                    + 'should be validated against the actual implementation before go-live.',
                font: 'Arial',
                size: 19,
                color: TEXT_DARK,
            })],
            spacing: { before: 80, after: 80 },
        }),

        new Paragraph({ children: [new PageBreak()] }),
    ];

    // ── TOC ─────────────────────────────────────────────────────────────────
    const tocSection = [
        new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'Table of Contents', font: 'Arial', size: 32, bold: true, color: ADOBE_BLUE })],
            spacing: { before: 240, after: 200 },
        }),
        new TableOfContents('Table of Contents', {
            hyperlink: true,
            headingStyleRange: '1-3',
        }),
        new Paragraph({ children: [new PageBreak()] }),
    ];

    // ── Content Sections ────────────────────────────────────────────────────
    const contentChildren = [];
    for (let si = 0; si < parsed.sections.length; si++) {
        const section = parsed.sections[si];
        contentChildren.push(
            new Paragraph({
                heading: HeadingLevel.HEADING_1,
                children: [new TextRun({
                    text: section.title,
                    font: 'Arial',
                    size: 30,
                    bold: true,
                    color: ADOBE_BLUE,
                })],
                spacing: { before: 360, after: 200 },
                pageBreakBefore: si > 0,
            })
        );
        for (const child of section.children) {
            contentChildren.push(...nodeToElements(child));
        }
    }

    // ── Appendix: JavaScript ─────────────────────────────────────────────────
    const appendixChildren = [
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({
                text: 'Appendix A — Adobe Data Layer Implementation',
                font: 'Arial',
                size: 30,
                bold: true,
                color: ADOBE_BLUE,
            })],
            spacing: { before: 360, after: 200 },
        }),
        new Paragraph({
            children: [new TextRun({
                text: 'Complete JavaScript implementation for adobeDataLayer integration. '
                    + 'This code provides all tracking functions referenced in the sections above.',
                font: 'Arial',
                size: 19,
                color: TEXT_GRAY,
            })],
            spacing: { after: 200 },
        }),
        ...buildCodeBlock(javascript || '// No JavaScript generated', 'javascript'),
    ];

    // ── Header / Footer ──────────────────────────────────────────────────────
    const makeHeader = () => new Header({
        children: [
            new Paragraph({
                children: [
                    new TextRun({ text: 'Technical Solution Design  |  ', font: 'Arial', size: 17, color: TEXT_GRAY }),
                    new TextRun({ text: clientName, font: 'Arial', size: 17, bold: true, color: ADOBE_BLUE }),
                ],
                alignment: AlignmentType.RIGHT,
                border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ADOBE_BLUE, space: 4 } },
                spacing: { after: 0 },
            }),
        ],
    });

    const makeFooter = () => new Footer({
        children: [
            new Paragraph({
                children: [
                    new TextRun({ text: 'CONFIDENTIAL  |  Adobe Analytics Implementation', font: 'Arial', size: 15, color: TEXT_GRAY }),
                    new TextRun({ text: '\t\t\tPage ', font: 'Arial', size: 15, color: TEXT_GRAY }),
                    new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 15, color: TEXT_GRAY }),
                    new TextRun({ text: ' of ', font: 'Arial', size: 15, color: TEXT_GRAY }),
                    new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 15, color: TEXT_GRAY }),
                ],
                border: { top: { style: BorderStyle.SINGLE, size: 6, color: BORDER_GRAY, space: 4 } },
                spacing: { before: 0 },
            }),
        ],
    });

    // ── Heading Styles ───────────────────────────────────────────────────────
    const paragraphStyles = [
        {
            id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
            run: { size: 30, bold: true, font: 'Arial', color: ADOBE_BLUE },
            paragraph: {
                spacing: { before: 360, after: 200 },
                outlineLevel: 0,
            },
        },
        {
            id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
            run: { size: 22, bold: true, font: 'Arial', color: '333333' },
            paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 },
        },
        {
            id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
            run: { size: 20, bold: true, font: 'Arial', color: '555555' },
            paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 },
        },
    ];

    // ── Assemble ─────────────────────────────────────────────────────────────
    const pageLayout = {
        page: {
            size: { width: PAGE_W, height: PAGE_H },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
    };

    return new Document({
        styles: {
            default: {
                document: { run: { font: 'Arial', size: 20, color: TEXT_DARK } },
            },
            paragraphStyles,
        },
        sections: [
            // Section 1: Cover page (no header/footer)
            {
                properties: { ...pageLayout },
                children: coverChildren,
            },
            // Section 2: Document Control + TOC + Content + Appendix (with header/footer)
            {
                properties: { ...pageLayout },
                headers: { default: makeHeader() },
                footers: { default: makeFooter() },
                children: [
                    ...docControlSection,
                    ...tocSection,
                    ...contentChildren,
                    ...appendixChildren,
                ],
            },
        ],
    });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    let raw = '';
    process.stdin.setEncoding('utf8');

    await new Promise((resolve, reject) => {
        process.stdin.on('data', chunk => { raw += chunk; });
        process.stdin.on('end', resolve);
        process.stdin.on('error', reject);
    });

    let payload;
    try {
        payload = JSON.parse(raw);
    } catch (e) {
        process.stdout.write(JSON.stringify({ success: false, error: `Invalid JSON input: ${e.message}` }));
        process.exit(1);
    }

    const { clientName = 'Client', markdown = '', javascript = '' } = payload;

    if (!markdown.trim()) {
        process.stdout.write(JSON.stringify({ success: false, error: 'markdown is empty' }));
        process.exit(1);
    }

    try {
        const parsed = parseMarkdown(markdown);
        const doc    = buildDocument(parsed, clientName, javascript);
        const buffer = await Packer.toBuffer(doc);
        const b64    = buffer.toString('base64');
        process.stdout.write(JSON.stringify({
            success: true,
            base64: b64,
            sectionCount: parsed.sections.length,
        }));
    } catch (e) {
        process.stdout.write(JSON.stringify({ success: false, error: e.message, stack: e.stack }));
        process.exit(1);
    }
}

main().catch(e => {
    process.stdout.write(JSON.stringify({ success: false, error: String(e) }));
    process.exit(1);
});
