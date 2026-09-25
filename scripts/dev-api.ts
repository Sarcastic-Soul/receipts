// Local stand-in for Vercel's /api routing: `bun run dev:api`, then `bun run dev`.
// Loads .env automatically (bun does this) and maps /api/<name> to api/<name>.ts.

const port = 3001;

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    const name = url.pathname.replace(/^\/api\//, "").replace(/[^a-z-]/g, "");
    try {
      const mod = await import(`../api/${name}.ts`);
      const handler = mod[req.method];
      if (typeof handler !== "function") return new Response("method not allowed", { status: 405 });
      return await handler(req);
    } catch (err) {
      console.error(err);
      return new Response("not found", { status: 404 });
    }
  },
});

console.log(`API on http://localhost:${port}`);
