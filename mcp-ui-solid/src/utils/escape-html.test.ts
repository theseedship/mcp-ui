import { describe, it, expect } from 'vitest';
import { escapeHtml } from './escape-html';

describe('escapeHtml', () => {
  it('escapes all five significant HTML characters', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('escapes the single quote (the case MapRenderer previously missed)', () => {
    expect(escapeHtml("O'Brien")).toBe('O&#39;Brien');
  });

  it('escapes ampersand first so entities are not double-encoded incorrectly', () => {
    expect(escapeHtml('a & b < c')).toBe('a &amp; b &lt; c');
  });

  it('neutralizes a script-injection attempt in a popup/tooltip value', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
    );
  });

  it('leaves a plain string untouched', () => {
    expect(escapeHtml('Toulouse 31000')).toBe('Toulouse 31000');
  });

  it('returns an empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });
});
