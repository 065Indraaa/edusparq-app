/**
 * File Generator — konversi HTML/Markdown konten ke file download (MD, DOCX).
 *
 * Dipakai oleh /api/export untuk menghasilkan file terstruktur dari output AI
 * atau dokumen Writing Studio.
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  PageBreak, LevelFormat, convertInchesToTwip,
} from "docx";

// ─── HTML → Markdown ────────────────────────────────────────────────────────

/**
 * Konversi HTML sederhana ke Markdown.
 * Mendukung: h1-h3, p, strong/b, em/i, ul/ol/li, blockquote, code.
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return "";
  let md = html;

  // Headings
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gis, (_, t) => `# ${stripTags(t)}\n\n`);
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gis, (_, t) => `## ${stripTags(t)}\n\n`);
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gis, (_, t) => `### ${stripTags(t)}\n\n`);
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gis, (_, t) => `#### ${stripTags(t)}\n\n`);

  // Bold & italic
  md = md.replace(/<(strong|b)[^>]*>(.*?)<\/\1>/gis, (_, _t) => `**${stripTags(_t)}**`);
  md = md.replace(/<(em|i)[^>]*>(.*?)<\/\1>/gis, (_, _t) => `*${stripTags(_t)}*`);

  // Blockquote
  md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (_, t) => {
    return stripTags(t).split("\n").map((l: string) => `> ${l}`).join("\n") + "\n\n";
  });

  // Code blocks
  md = md.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, (_, t) => `\`\`\`\n${stripTags(t)}\n\`\`\`\n\n`);
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gis, (_, t) => `\`${stripTags(t)}\``);

  // Lists
  md = md.replace(/<ul[^>]*>(.*?)<\/ul>/gis, (_, t) => {
    return t.replace(/<li[^>]*>(.*?)<\/li>/gis, (_2: any, li: string) => `- ${stripTags(li)}\n`) + "\n";
  });
  md = md.replace(/<ol[^>]*>(.*?)<\/ol>/gis, (_, t) => {
    let idx = 1;
    return t.replace(/<li[^>]*>(.*?)<\/li>/gis, () => `${idx++}. ${stripTags(arguments[1])}\n`) + "\n";
  });

  // Paragraphs & breaks
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gis, (_, t) => `${t}\n\n`);
  md = md.replace(/<br\s*\/?>/gi, "\n");

  // Strip remaining tags
  md = stripTags(md);

  // Clean up extra whitespace
  md = md.replace(/\n{3,}/g, "\n\n").trim() + "\n";

  return md;
}

function stripTags(html: string): string {
  return String(html || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

// ─── HTML → DOCX ────────────────────────────────────────────────────────────

interface DocxBlock {
  type: "heading1" | "heading2" | "heading3" | "paragraph" | "list-item" | "numbered-item" | "blockquote" | "code";
  text: string;
  bold?: boolean;
  italic?: boolean;
}

/**
 * Parse HTML sederhana menjadi array block untuk DOCX generation.
 */
function parseHtmlToBlocks(html: string): DocxBlock[] {
  const blocks: DocxBlock[] = [];
  if (!html) return blocks;

  // Split by block-level tags
  const parts = html.split(/(<h[1-4][^>]*>.*?<\/h[1-4]>|<p[^>]*>.*?<\/p>|<li[^>]*>.*?<\/li>|<blockquote[^>]*>.*?<\/blockquote>|<pre[^>]*>.*?<\/pre>)/gis);

  let inList: "ul" | "ol" | null = null;
  let listIdx = 0;

  for (const part of parts) {
    if (!part || !part.trim()) continue;

    if (/^<h1/i.test(part)) {
      blocks.push({ type: "heading1", text: stripTags(part) });
    } else if (/^<h2/i.test(part)) {
      blocks.push({ type: "heading2", text: stripTags(part) });
    } else if (/^<h[34]/i.test(part)) {
      blocks.push({ type: "heading3", text: stripTags(part) });
    } else if (/^<blockquote/i.test(part)) {
      blocks.push({ type: "blockquote", text: stripTags(part), italic: true });
    } else if (/^<pre/i.test(part)) {
      blocks.push({ type: "code", text: stripTags(part) });
    } else if (/^<li/i.test(part)) {
      // Detect inline formatting
      const hasBold = /<(strong|b)/i.test(part);
      const hasItalic = /<(em|i)/i.test(part);
      blocks.push({
        type: inList === "ol" ? "numbered-item" : "list-item",
        text: stripTags(part),
        bold: hasBold,
        italic: hasItalic,
      });
    } else if (/^<p/i.test(part)) {
      // Detect inline formatting
      const hasBold = /<(strong|b)/i.test(part);
      const hasItalic = /<(em|i)/i.test(part);
      blocks.push({ type: "paragraph", text: stripTags(part), bold: hasBold, italic: hasItalic });
    } else if (/<ul/i.test(part)) {
      inList = "ul";
    } else if (/<ol/i.test(part)) {
      inList = "ol";
      listIdx = 0;
    } else if (/<\/ul|<\/ol/i.test(part)) {
      inList = null;
    }
  }

  return blocks;
}

/**
 * Generate DOCX buffer dari HTML content.
 * Style: Times New Roman 12pt, margin standar Indonesia (4-4-3-3 cm).
 */
export async function generateDocx(opts: {
  title: string;
  content: string; // HTML
  author?: string;
  courseName?: string;
}): Promise<Buffer> {
  const blocks = parseHtmlToBlocks(opts.content);

  // Cover page
  const children: Paragraph[] = [
    new Paragraph({ children: [], spacing: { before: 2000 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: opts.title, bold: true, size: 32, font: "Times New Roman" })],
    }),
  ];

  if (opts.author) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
      children: [new TextRun({ text: opts.author, size: 24, font: "Times New Roman" })],
    }));
  }
  if (opts.courseName) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: opts.courseName, size: 24, italics: true, font: "Times New Roman" })],
    }));
  }

  // Page break after cover
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // Content blocks
  let numberingCounter = 0;
  for (const block of blocks) {
    switch (block.type) {
      case "heading1":
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
          children: [new TextRun({ text: block.text, bold: true, size: 28, font: "Times New Roman" })],
        }));
        break;
      case "heading2":
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
          children: [new TextRun({ text: block.text, bold: true, size: 26, font: "Times New Roman" })],
        }));
        break;
      case "heading3":
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 160, after: 80 },
          children: [new TextRun({ text: block.text, bold: true, size: 24, font: "Times New Roman" })],
        }));
        break;
      case "list-item":
        children.push(new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 80 },
          children: [new TextRun({ text: block.text, size: 24, font: "Times New Roman", bold: block.bold, italics: block.italic })],
        }));
        break;
      case "numbered-item":
        numberingCounter++;
        children.push(new Paragraph({
          spacing: { after: 80 },
          indent: { left: convertInchesToTwip(0.3) },
          children: [new TextRun({ text: `${numberingCounter}. ${block.text}`, size: 24, font: "Times New Roman", bold: block.bold, italics: block.italic })],
        }));
        break;
      case "blockquote":
        children.push(new Paragraph({
          indent: { left: convertInchesToTwip(0.5) },
          spacing: { after: 120 },
          children: [new TextRun({ text: `"${block.text}"`, size: 24, italics: true, font: "Times New Roman" })],
        }));
        break;
      case "code":
        children.push(new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: block.text, size: 20, font: "Courier New" })],
        }));
        break;
      default:
        numberingCounter = 0; // reset numbering for non-list blocks
        children.push(new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 120, line: 360 }, // 1.5 line spacing
          children: [new TextRun({ text: block.text, size: 24, font: "Times New Roman", bold: block.bold, italics: block.italic })],
        }));
    }
  }

  const doc = new Document({
    creator: opts.author || "EduSparq",
    title: opts.title,
    description: "Generated by EduSparq AI",
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1.57),    // 4 cm
            bottom: convertInchesToTwip(1.18), // 3 cm
            left: convertInchesToTwip(1.57),   // 4 cm
            right: convertInchesToTwip(1.18),  // 3 cm
          },
        },
      },
      children,
    }],
  });

  return await Packer.toBuffer(doc) as unknown as Buffer;
}
