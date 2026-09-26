import { describe, expect, it } from "vitest";
import { matchCategory, matchExchange } from "../lib/claims/lookup";
import { categoriesAll, exchangesAll } from "./fixtures";

describe("matchExchange", () => {
  it("matches exact names and slugs", () => {
    expect(matchExchange("Binance", exchangesAll)?.id).toBe(270);
    expect(matchExchange("kraken", exchangesAll)?.id).toBe(24);
  });
  it("uses aliases and prefixes", () => {
    expect(matchExchange("Coinbase", exchangesAll)?.id).toBe(89);
    expect(matchExchange("Gate.io", exchangesAll)?.id).toBe(302);
  });
  it("returns null for unknown exchanges", () => {
    expect(matchExchange("Nowhere DEX", exchangesAll)).toBeNull();
  });
});

describe("matchCategory", () => {
  it("maps common sector words to CMC categories", () => {
    expect(matchCategory("AI", categoriesAll)?.name).toBe("AI & Big Data");
    expect(matchCategory("meme coins", categoriesAll)?.name).toBe("Memes");
    expect(matchCategory("Memes", categoriesAll)?.name).toBe("Memes");
  });
  it("returns null for unknown sectors", () => {
    expect(matchCategory("quantum", categoriesAll)).toBeNull();
  });
});
