/**
 * MapRenderer XSS hardening tests (audit P1.2, v6.10.0).
 *
 * Leaflet renders bound tooltip/popup strings as HTML, so untrusted payload
 * content (`marker.tooltip`, `marker.popup`, GeoJSON `popup.template`) is an
 * XSS vector. These lock the safe-by-default behavior and the host opt-in,
 * via the pure exported helpers (the Leaflet binding itself is a thin wrapper
 * and not exercisable in jsdom).
 */

import { describe, it, expect } from 'vitest';
import { popupSafeText, buildPopupContent } from './MapRenderer';

const XSS = '<img src=x onerror=alert(1)>';

describe('popupSafeText — marker tooltip/popup (P1.2)', () => {
  it('escapes HTML by default (untrusted payload path)', () => {
    const out = popupSafeText(XSS);
    expect(out).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(out).not.toContain('<img');
  });

  it('escapes < > & " so no tag can be injected', () => {
    expect(popupSafeText('a & b <c> "d"')).toBe('a &amp; b &lt;c&gt; &quot;d&quot;');
  });

  it('passes raw HTML through when the host opts in (trusted)', () => {
    expect(popupSafeText(XSS, true)).toBe(XSS);
  });

  it('returns undefined for absent content', () => {
    expect(popupSafeText(undefined)).toBeUndefined();
    expect(popupSafeText(undefined, true)).toBeUndefined();
  });

  it('leaves plain text visually unchanged', () => {
    expect(popupSafeText('Paris')).toBe('Paris');
  });
});

describe('buildPopupContent — GeoJSON popup (P1.2)', () => {
  const feature = (props: Record<string, unknown>) => ({ properties: props });

  it('ignores a raw `popup.template` on the default (untrusted) path', () => {
    const html = buildPopupContent(
      feature({ name: 'Zone' }),
      { template: `<b>{{name}}</b><img src=x onerror=alert(1)>` }
      // allowHtml defaults to false
    );
    // Template skipped → falls through to the auto popup (no <img>, no <b>).
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>');
  });

  it('honors `popup.template` when the host opts in, but escapes substituted values', () => {
    const html = buildPopupContent(
      feature({ name: '<script>evil</script>' }),
      { template: '<b>{{name}}</b>' },
      true
    );
    // The authored structural HTML stays; the data value is escaped.
    expect(html).toContain('<b>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('auto-generated popup always escapes values (safe by construction)', () => {
    const html = buildPopupContent(
      feature({ title: XSS, count: 5 }),
      { titleField: 'title', fields: ['count'] }
      // default untrusted path
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    // structural HTML authored by the renderer is present
    expect(html).toContain('<strong>');
  });

  it('returns null when there is no popup config or no properties', () => {
    expect(buildPopupContent({ properties: { a: 1 } }, undefined)).toBeNull();
    expect(buildPopupContent({}, { titleField: 'a' })).toBeNull();
  });
});
