import * as cheerio from "cheerio";

export async function searchWeb(query: string, maxResults: number = 3): Promise<string> {
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    
    // Header penting agar DuckDuckGo tidak memblokir bot
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    if (!res.ok) {
      throw new Error("Gagal mengambil data dari DuckDuckGo");
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const results: string[] = [];

    // DuckDuckGo HTML version uses a.result__url and a.result__snippet
    $(".result").each((i, el) => {
      if (i >= maxResults) return false;
      const title = $(el).find(".result__title").text().trim();
      const snippet = $(el).find(".result__snippet").text().trim();
      const url = $(el).find(".result__url").attr("href") || "";

      if (title && snippet) {
        results.push(`[Sumber: ${title}] (${url})\n${snippet}`);
      }
    });

    if (results.length === 0) {
      return "Pencarian web tidak mengembalikan hasil spesifik untuk kueri ini.";
    }

    return "HASIL PENCARIAN WEB:\n" + results.join("\n\n");
  } catch (error) {
    console.error("Web Search Error:", error);
    return "Gagal melakukan pencarian web. Harap gunakan pengetahuan dasar.";
  }
}
