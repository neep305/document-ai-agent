#!/usr/bin/env node
/**
 * generate_tsd.js — Convert TSD Agent markdown output to a formatted .docx file.
 *
 * Input  (stdin): JSON { "clientName": "...", "markdown": "...", "javascript": "..." }
 * Output (stdout): JSON { "success": true, "base64": "<docx base64>" }
 * On error: JSON { "success": false, "error": "<message>" }
 */

'use strict';

const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
    ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
    TableOfContents,
} = require('docx');

// ── Constants ────────────────────────────────────────────────────────────────

const ADOBE_BLUE    = '0070D2';
const ADOBE_LIGHT   = 'D5E8F0';
const GRAY_BG       = 'F4F4F4';
const BORDER_GRAY   = 'CCCCCC';
const CONTENT_WIDTH = 9026; // A4 with 1" margins (11906 - 2*1440)

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: BORDER_GRAY };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

// ── Markdown Parser ───────────────────────────────────────────────────────────

/**
 * Very simple TSD-flavoured markdown to structure parser.
 * Handles: # title, ## section, ### subsection, pipes tables, ```code```, plain text.
 */
function parseMarkdown(md) {
    const lines = md.split('\n');
    const doc = { title: '', sections: [] };
    let currentSection = null;
    let currentSub = null;
    let inCode = false;
    let codeLang = '';
    let codeLines = [];
    let tableLines = [];
    let textLines = [];

    function target() { return currentSub || currentSection; }

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

    for (const line of lines) {
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
            flushTable(); flushText();
            inCode = true;
            codeLang = line.trim().slice(3).trim();
            continue;
        }

        if (line.startsWith('# ')) {
            doc.title = line.slice(2).trim();
            continue;
        }

        if (line.startsWith('## ')) {
            flushTable(); flushText();
            currentSub = null;
            currentSection = { type: 'section', title: line.slice(3).trim(), children: [] };
            doc.sections.push(currentSection);
            continue;
        }

        if (line.startsWith('### ')) {
            flushTable(); flushText();
            currentSub = { type: 'subsection', title: line.slice(4).trim(), children: [] };
            if (currentSection) {
                currentSection.children.push(currentSub);
            }
            continue;
        }

        if (line.startsWith('|')) {
            flushText();
            tableLines.push(line);
            continue;
        }

        if (tableLines.length && !line.startsWith('|')) {
            flushTable();
        }

        textLines.push(line);
    }

    flushTable();
    flushText();
    if (inCode && codeLines.length) push({ type: 'code', lang: codeLang, code: codeLines.join('\n') });

    return doc;
}

function parseTable(lines) {
    const rows = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (/^\|[\s\-:|]+\|$/.test(trimmed)) continue; // separator row
        const cells = trimmed.split('|').slice(1, -1).map(c => c.trim());
        if (cells.length) rows.push(cells);
    }
    if (!rows.length) return null;
    return { headers: rows[0], rows: rows.slice(1) };
}

// ── docx Builders ─────────────────────────────────────────────────────────────

function makeCell(text, { header = false, width = null, shade = null } = {}) {
    return new TableCell({
        borders: cellBorders,
        width: width ? { size: width, type: WidthType.DXA } : undefined,
        shading: shade
            ? { fill: shade, type: ShadingType.CLEAR }
            : (header ? { fill: ADOBE_LIGHT, type: ShadingType.CLEAR } : undefined),
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
            children: [new TextRun({
                text: String(text ?? ''),
                bold: header,
                font: 'Arial',
                size: 18,
            })]
        })],
    });
}

function buildTable(tableData) {
    const colCount = tableData.headers.length;
    const colWidth = Math.floor(CONTENT_WIDTH / colCount);
    const colWidths = tableData.headers.map((_, i) =>
        i === colCount - 1 ? CONTENT_WIDTH - colWidth * (colCount - 1) : colWidth
    );

    const headerRow = new TableRow({
        children: tableData.headers.map((h, i) =>
            makeCell(h, { header: true, width: colWidths[i] })
        ),
        tableHeader: true,
    });

    const dataRows = tableData.rows.map((row, ri) =>
        new TableRow({
            children: tableData.headers.map((_, i) =>
                makeCell(row[i] ?? '', {
                    width: colWidths[i],
                    shade: ri % 2 === 1 ? 'F8F8F8' : undefined,
                })
            ),
        })
    );

    return new Table({
        width: { size: CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths: colWidths,
        rows: [headerRow, ...dataRows],
    });
}

function buildCodeBlock(code) {
    const lines = code.split('\n');
    return lines.map(line =>
        new Paragraph({
            children: [new TextRun({ text: line || ' ', font: 'Courier New', size: 18, color: '1A1A1A' })],
            shading: { fill: GRAY_BG, type: ShadingType.CLEAR },
            spacing: { before: 0, after: 0, line: 240 },
            indent: { left: 360 },
            border: {
                left: { style: BorderStyle.SINGLE, size: 12, color: ADOBE_BLUE },
            },
        })
    );
}

function buildTextParagraphs(text) {
    return text.split('\n')
        .filter(l => l.trim())
        .map(line =>
            new Paragraph({
                children: [new TextRun({ text: line.trim(), font: 'Arial', size: 20 })],
                spacing: { before: 60, after: 60 },
            })
        );
}

function nodeToElements(node) {
    const elements = [];

    if (node.type === 'subsection') {
        elements.push(
            new Paragraph({
                heading: HeadingLevel.HEADING_2,
                children: [new TextRun({ text: node.title, font: 'Arial', size: 24, bold: true })],
                spacing: { before: 200, after: 120 },
            })
        );
        for (const child of node.children) {
            elements.push(...nodeToElements(child));
        }
        return elements;
    }

    if (node.type === 'text') {
        elements.push(...buildTextParagraphs(node.text));
        return elements;
    }

    if (node.type === 'table') {
        elements.push(buildTable(node.table));
        elements.push(new Paragraph({ children: [], spacing: { before: 80, after: 80 } }));
        return elements;
    }

    if (node.type === 'code') {
        elements.push(...buildCodeBlock(node.code));
        elements.push(new Paragraph({ children: [], spacing: { after: 120 } }));
        return elements;
    }

    return elements;
}

// ── Document Assembly ─────────────────────────────────────────────────────────

function buildDocument(parsed, clientName, javascript) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // Cover page
    const coverChildren = [
        new Paragraph({ children: [], spacing: { before: 2880 } }),
        new Paragraph({
            children: [new TextRun({ text: 'Technical Solution Design', bold: true, font: 'Arial', size: 52, color: ADOBE_BLUE })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 240 },
        }),
        new Paragraph({
            children: [new TextRun({ text: clientName, font: 'Arial', size: 40, color: '333333' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
        }),
        new Paragraph({
            children: [new TextRun({ text: 'Adobe Analytics — AEP Web SDK Implementation', font: 'Arial', size: 24, color: '666666' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 480 },
        }),
        new Paragraph({
            children: [new TextRun({ text: dateStr, font: 'Arial', size: 20, color: '999999' })],
            alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ children: [new PageBreak()] }),
    ];

    // TOC page
    const tocChildren = [
        new TableOfContents('Table of Contents', {
            hyperlink: true,
            headingStyleRange: '1-2',
        }),
        new Paragraph({ children: [new PageBreak()] }),
    ];

    // Content sections
    const contentChildren = [];
    for (const section of parsed.sections) {
        contentChildren.push(
            new Paragraph({
                heading: HeadingLevel.HEADING_1,
                children: [new TextRun({ text: section.title, font: 'Arial', size: 32, bold: true })],
                spacing: { before: 320, after: 160 },
                pageBreakBefore: contentChildren.length > 0,
            })
        );
        for (const child of section.children) {
            contentChildren.push(...nodeToElements(child));
        }
    }

    // Appendix: JavaScript source
    const appendixChildren = [
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'Appendix A — Adobe Data Layer Implementation', font: 'Arial', size: 32, bold: true })],
            spacing: { before: 320, after: 160 },
        }),
        new Paragraph({
            children: [new TextRun({ text: 'Complete JavaScript implementation for adobeDataLayer integration.', font: 'Arial', size: 20, color: '666666' })],
            spacing: { after: 240 },
        }),
        ...buildCodeBlock(javascript || '// No JavaScript generated'),
    ];

    const headerRun = () => new Header({
        children: [new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ADOBE_BLUE, space: 1 } },
            children: [
                new TextRun({ text: 'Technical Solution Design  |  ', font: 'Arial', size: 18, color: '666666' }),
                new TextRun({ text: clientName, font: 'Arial', size: 18, bold: true, color: ADOBE_BLUE }),
            ],
        })],
    });

    const footerRun = () => new Footer({
        children: [new Paragraph({
            border: { top: { style: BorderStyle.SINGLE, size: 6, color: BORDER_GRAY, space: 1 } },
            children: [
                new TextRun({ text: 'Adobe Analytics Implementation  |  ', font: 'Arial', size: 16, color: '999999' }),
                new TextRun({ text: 'Page ', font: 'Arial', size: 16, color: '999999' }),
                new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: '999999' }),
                new TextRun({ text: ' of ', font: 'Arial', size: 16, color: '999999' }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 16, color: '999999' }),
            ],
            alignment: AlignmentType.RIGHT,
        })],
    });

    return new Document({
        styles: {
            default: {
                document: { run: { font: 'Arial', size: 20 } },
            },
            paragraphStyles: [
                {
                    id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                    run: { size: 32, bold: true, font: 'Arial', color: ADOBE_BLUE },
                    paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0 },
                },
                {
                    id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                    run: { size: 24, bold: true, font: 'Arial', color: '333333' },
                    paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 },
                },
            ],
        },
        numbering: {
            config: [
                {
                    reference: 'bullets',
                    levels: [{
                        level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
                        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
                    }],
                },
            ],
        },
        sections: [
            // Cover page (no header/footer)
            {
                properties: {
                    page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
                },
                children: coverChildren,
            },
            // TOC + content + appendix (with header/footer)
            {
                properties: {
                    page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
                },
                headers: { default: headerRun() },
                footers: { default: footerRun() },
                children: [...tocChildren, ...contentChildren, ...appendixChildren],
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
        const doc = buildDocument(parsed, clientName, javascript);
        const buffer = await Packer.toBuffer(doc);
        const b64 = buffer.toString('base64');
        process.stdout.write(JSON.stringify({ success: true, base64: b64, sectionCount: parsed.sections.length }));
    } catch (e) {
        process.stdout.write(JSON.stringify({ success: false, error: e.message, stack: e.stack }));
        process.exit(1);
    }
}

main().catch(e => {
    process.stdout.write(JSON.stringify({ success: false, error: String(e) }));
    process.exit(1);
});
