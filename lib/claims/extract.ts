import { createHash } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { getStore } from "../store.js";
import { fallbackExtract } from "./fallback.js";
import { Extraction } from "./schema.js";

const PROMPT = `You extract checkable claims from a crypto social media post.
Return JSON only, matching the schema.

coins: every cryptocurrency the post talks about. Use the ticker symbol (uppercase, no $) when known,
the full name when given, and any contract address exactly as written.
Exchanges (Binance, Coinbase, OKX...) are not coins: "listed on Binance" does not mention BNB.
Only list an exchange's own token if the post names the token itself ($BNB, "BNB coin").

claims: each separate statement about a coin or the market. Pick the closest kind:
- price_change: price went up/down by some amount over a period ("up 300% this week", "10x today"; 10x = 900 percent)
- price_level: the price is above/below/about a dollar value
- rank: "top N" or "#N on CMC"
- market_cap: market cap size, including "low cap", "micro cap" (comparator below, usdValue null if no number)
- volume_spike: trading volume is exploding / surging / up
- listed_on_exchange: listed or trading on a named exchange
- new_listing: just launched, brand new, just listed
- fixed_supply: fixed, capped or limited supply
- trending: trending on CMC / everywhere
- market_wide: claims about the whole crypto market
- unverifiable: facts that market data can't show (team doxxed, audited, partnerships, whales buying, burns, insiders). Put why in reason.
- opinion: predictions and hype ("next 100x", "going to $1", "undervalued", "don't fade this"). Put why in reason.
Quote the post's own words in quote. Leave fields null when they don't apply. Never invent numbers.
Skip greetings, emojis and calls to action that make no claim.

Post:
"""
{TEXT}
"""`;

// Bump when the prompt or schema changes, so old cached extractions are not reused.
const PROMPT_VERSION = 2;

export interface ExtractResult {
  extraction: Extraction;
  extractor: "gemini" | "fallback";
  note?: string;
}

/** Claims don't change for the same text, so LLM results are cached forever by text hash. */
export async function extractClaims(text: string): Promise<ExtractResult> {
  const key = `x${PROMPT_VERSION}:${createHash("sha256").update(text).digest("hex").slice(0, 32)}`;
  const store = getStore();
  const cached = await store.get<Extraction>(key).catch(() => null);
  if (cached) return { extraction: cached, extractor: "gemini" };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { extraction: fallbackExtract(text), extractor: "fallback", note: "No LLM key set, used the rule-based extractor." };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const res = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: PROMPT.replace("{TEXT}", text.slice(0, 4000)),
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(Extraction),
        temperature: 0,
      },
    });
    const parsed = Extraction.safeParse(JSON.parse(res.text ?? "{}"));
    if (!parsed.success) throw new Error("LLM output did not match the claim schema");
    await store.set(key, parsed.data).catch(() => {});
    return { extraction: parsed.data, extractor: "gemini" };
  } catch (err) {
    return {
      extraction: fallbackExtract(text),
      extractor: "fallback",
      note: `LLM claim extraction failed (${(err as Error).message}), used the rule-based extractor.`,
    };
  }
}
