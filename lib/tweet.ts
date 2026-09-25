// Gets tweet text from X's free public oEmbed endpoint (no API key).

export interface Tweet {
  url: string;
  author: string;
  authorUrl: string;
  text: string;
}

export async function fetchTweet(url: string, fetchImpl: typeof fetch = fetch): Promise<Tweet> {
  const endpoint = `https://publish.twitter.com/oembed?omit_script=true&dnt=true&url=${encodeURIComponent(url)}`;
  const res = await fetchImpl(endpoint, { redirect: "follow" });
  if (!res.ok) throw new Error(`X oEmbed returned HTTP ${res.status}`);
  const body = (await res.json()) as { html?: string; author_name?: string; author_url?: string };
  if (!body.html) throw new Error("X oEmbed returned no tweet HTML");
  return {
    url,
    author: body.author_name ?? "",
    authorUrl: body.author_url ?? "",
    text: tweetTextFromHtml(body.html),
  };
}

/** Pull the post text out of the oEmbed blockquote HTML. */
export function tweetTextFromHtml(html: string): string {
  const p = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  const inner = p ? p[1] : html;
  return decodeEntities(
    inner
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<a[^>]*>(pic\.(?:twitter|x)\.com\/\w+)<\/a>/gi, "")
      .replace(/<[^>]+>/g, ""),
  ).trim();
}

function decodeEntities(s: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "—" };
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => named[n.toLowerCase()] ?? m);
}
