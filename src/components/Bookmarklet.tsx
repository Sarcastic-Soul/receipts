import { useEffect, useRef } from "react";

// Drag-to-bookmarks button: select text on any page, click it, and Receipts opens with that text.
export function Bookmarklet() {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    // React blocks javascript: URLs in href, so set it directly.
    const code = `javascript:(()=>{const t=String(window.getSelection()).trim()||location.href;window.open('${window.location.origin}/?text='+encodeURIComponent(t.slice(0,2000)),'_blank');})()`;
    ref.current?.setAttribute("href", code);
  }, []);
  return (
    <section className="mt-10 rounded-md border-2 border-dashed border-rule p-4">
      <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Check from any page</h2>
      <p className="mb-3 text-sm text-muted">
        Drag this button to your bookmarks bar. On X (or anywhere), select a post's text and click it. No selection? It
        checks the page's link.
      </p>
      <a
        ref={ref}
        onClick={(e) => e.preventDefault()}
        className="inline-block cursor-grab rounded-md border-2 border-ink bg-paper px-3 py-1.5 font-mono text-sm font-semibold"
      >
        🧾 Check it
      </a>
    </section>
  );
}
