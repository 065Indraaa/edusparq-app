/**
 * Pure citation formatting helpers (no React).
 * Produces a single-line reference string for 4 common styles.
 * Defensive: tolerates missing optional fields.
 */

export interface CitationInput {
  author: string;
  title: string;
  year: string;
  journal?: string;
  volume?: string;
  issue?: string;
  page?: string;
  publisher?: string;
  url?: string;
  doi?: string;
}

export type CitationStyle = "APA" | "MLA" | "IEEE" | "Harvard";

export const CITATION_STYLES: CitationStyle[] = ["APA", "MLA", "IEEE", "Harvard"];

/** Collapse repeated whitespace and trim trailing separators left by empty fields. */
function tidy(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;])/g, "$1")
    .replace(/([.,;])\1+/g, "$1")
    .replace(/[\s,;.]+$/g, "")
    .trim()
    .concat(".");
}

/** Split "Last, F." style authors into { last, initial }. Falls back gracefully. */
function splitAuthor(author: string): { last: string; initial: string } {
  const a = (author || "").trim();
  if (!a) return { last: "", initial: "" };
  const parts = a.split(",");
  const last = (parts[0] || a).trim();
  const initial = (parts[1] || "").trim();
  return { last, initial };
}

/** Journal locator like "Vol(Issue), pages" — only includes present parts. */
function journalLocatorApa(c: CitationInput): string {
  let loc = "";
  if (c.volume) loc += c.volume;
  if (c.issue) loc += `(${c.issue})`;
  if (c.page) loc += loc ? `, ${c.page}` : c.page;
  return loc;
}

function tail(c: CitationInput): string {
  // DOI preferred over URL when present.
  if (c.doi) return ` https://doi.org/${c.doi.replace(/^https?:\/\/doi\.org\//i, "")}`;
  if (c.url) return ` ${c.url}`;
  return "";
}

export function formatCitation(c: CitationInput, style: CitationStyle): string {
  const { last, initial } = splitAuthor(c.author);
  const author = [last, initial].filter(Boolean).join(", ");
  const year = c.year || "n.d.";
  const title = c.title || "Tanpa judul";
  const journal = c.journal?.trim();
  const publisher = c.publisher?.trim();

  switch (style) {
    case "APA": {
      // Last, F. (Year). Title. Journal, Vol(Issue), pages. / Publisher.
      const lead = `${author} (${year}). ${title}.`;
      const body = journal
        ? ` ${journal}${journalLocatorApa(c) ? `, ${journalLocatorApa(c)}` : ""}.`
        : publisher
          ? ` ${publisher}.`
          : "";
      return tidy(lead + body + tail(c));
    }

    case "MLA": {
      // Last, First. "Title." Journal, vol. X, no. Y, Year, pp. Z.
      const lead = `${author}. "${title}."`;
      let body = "";
      if (journal) {
        const bits: string[] = [journal];
        if (c.volume) bits.push(`vol. ${c.volume}`);
        if (c.issue) bits.push(`no. ${c.issue}`);
        bits.push(year);
        if (c.page) bits.push(`pp. ${c.page}`);
        body = ` ${bits.join(", ")}.`;
      } else if (publisher) {
        body = ` ${publisher}, ${year}.`;
      } else {
        body = ` ${year}.`;
      }
      return tidy(lead + body + tail(c));
    }

    case "IEEE": {
      // F. Last, "Title," Journal, vol. X, no. Y, pp. Z, Year.
      const name = [initial, last].filter(Boolean).join(" ") || author;
      const lead = `${name}, "${title},"`;
      let body = "";
      if (journal) {
        const bits: string[] = [journal];
        if (c.volume) bits.push(`vol. ${c.volume}`);
        if (c.issue) bits.push(`no. ${c.issue}`);
        if (c.page) bits.push(`pp. ${c.page}`);
        bits.push(year);
        body = ` ${bits.join(", ")}.`;
      } else if (publisher) {
        body = ` ${publisher}, ${year}.`;
      } else {
        body = ` ${year}.`;
      }
      return tidy(lead + body + tail(c));
    }

    case "Harvard": {
      // Last, F. Year, 'Title', Journal, vol. X, no. Y, pp. Z.
      const lead = `${author} ${year}, '${title}',`;
      let body = "";
      if (journal) {
        const bits: string[] = [journal];
        if (c.volume) bits.push(`vol. ${c.volume}`);
        if (c.issue) bits.push(`no. ${c.issue}`);
        if (c.page) bits.push(`pp. ${c.page}`);
        body = ` ${bits.join(", ")}.`;
      } else if (publisher) {
        body = ` ${publisher}.`;
      }
      return tidy(lead + body + tail(c));
    }

    default:
      return tidy(`${author} (${year}). ${title}.`);
  }
}
