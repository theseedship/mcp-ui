/**
 * Canonical HTML-escaper for untrusted payload values bound into HTML-string
 * contexts (Leaflet marker popups/tooltips, G6 node/edge tooltips).
 *
 * Escapes the five significant characters — `& < > " '` — so a value is safe
 * in both text-node and quoted-attribute positions. Pure + exported for tests.
 *
 * Consolidated (audit 2026-05-30 hygiene pass) from two previously-divergent
 * private copies: MapRenderer's escaped `& < > "` (it MISSED the single quote),
 * GraphRenderer's escaped all five. This single source removes that divergence.
 */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) =>
    c === '&'
      ? '&amp;'
      : c === '<'
        ? '&lt;'
        : c === '>'
          ? '&gt;'
          : c === '"'
            ? '&quot;'
            : '&#39;'
  );
}
