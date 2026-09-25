import { describe, expect, it } from "vitest";
import { classifyInput, findAddresses, findCashtags, findTweetUrl } from "../lib/detect";
import { tweetTextFromHtml } from "../lib/tweet";

describe("findCashtags", () => {
  it("finds tickers and uppercases them", () => {
    expect(findCashtags("$pepe and $WIF are going up, $PEPE again")).toEqual(["PEPE", "WIF"]);
  });
  it("ignores dollar amounts and fiat", () => {
    expect(findCashtags("worth $100 or $5M in $USD")).toEqual([]);
  });
  it("ignores $ inside words", () => {
    expect(findCashtags("a$BTC")).toEqual([]);
  });
});

describe("findAddresses", () => {
  it("finds EVM addresses in lowercase", () => {
    expect(findAddresses("CA: 0x6982508145454Ce325dDbE47a25d4ec3d2311933")).toEqual(["0x6982508145454ce325ddbe47a25d4ec3d2311933"]);
  });
  it("finds Solana addresses", () => {
    expect(findAddresses("mint EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm")).toEqual(["EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm"]);
  });
  it("does not treat long words as Solana addresses", () => {
    expect(findAddresses("supercalifragilisticexpialidociouswords")).toEqual([]);
  });
});

describe("findTweetUrl", () => {
  it("normalises twitter.com and x.com links", () => {
    expect(findTweetUrl("see https://twitter.com/elonmusk/status/123456789?s=20")).toBe("https://x.com/elonmusk/status/123456789");
    expect(findTweetUrl("https://mobile.x.com/a_b/status/99999")).toBe("https://x.com/a_b/status/99999");
  });
});

describe("classifyInput", () => {
  it("classifies each input kind", () => {
    expect(classifyInput("https://x.com/a/status/123456")).toBe("tweet");
    expect(classifyInput("0x6982508145454ce325ddbe47a25d4ec3d2311933")).toBe("address");
    expect(classifyInput("$PEPE")).toBe("ticker");
    expect(classifyInput("pepe")).toBe("ticker");
    expect(classifyInput("$PEPE to the moon")).toBe("text");
  });
});

describe("tweetTextFromHtml", () => {
  it("pulls the text out of the oEmbed HTML", () => {
    const html =
      '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">$PEPE up 300% &amp; climbing<br>🚀 <a href="https://t.co/x">pic.twitter.com/abc123</a></p>&mdash; Shill (@shill) <a href="#">Sep 1</a></blockquote>';
    expect(tweetTextFromHtml(html)).toBe("$PEPE up 300% & climbing\n🚀");
  });
});

describe("fallbackExtract", () => {
  it("ties each claim to the coin named in its sentence", async () => {
    const { fallbackExtract } = await import("../lib/claims/fallback");
    const r = fallbackExtract("$PEPE is up 300% this week 🚀 Also $WIF just launched. It's top 100 already");
    expect(r.claims.map((c) => [c.kind, c.coin])).toEqual([
      ["price_change", "PEPE"],
      ["new_listing", "WIF"],
      ["rank", "WIF"],
    ]);
    expect(r.claims[0]).toMatchObject({ percent: 300, period: "7d", quote: "$PEPE is up 300% this week" });
  });
});
