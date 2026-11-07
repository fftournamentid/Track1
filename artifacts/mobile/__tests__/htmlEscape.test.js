'use strict';

const assert = require('assert');

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeImageUrl(url) {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return '';
}

console.log('Running HTML Escaping & Sanitization Tests...');

// 1. Client name with XSS payload
{
  const maliciousInput = '<img src=x onerror=alert(1)>';
  const escaped = escapeHtml(maliciousInput);
  assert.strictEqual(
    escaped,
    '&lt;img src=x onerror=alert(1)&gt;',
    'XSS payload must be escaped and render as visible text, not an executable HTML tag'
  );
  assert.ok(!escaped.includes('<img'), 'Must not contain raw <img');
}

// 2. Escape quotes, ampersands, null, undefined
{
  assert.strictEqual(escapeHtml(null), '');
  assert.strictEqual(escapeHtml(undefined), '');
  assert.strictEqual(escapeHtml('Tom & Jerry'), 'Tom &amp; Jerry');
  assert.strictEqual(escapeHtml('"Hello" \'World\''), '&quot;Hello&quot; &#39;World&#39;');
}

// 3. Image URL sanitization
{
  assert.strictEqual(sanitizeImageUrl('data:image/png;base64,ABC'), 'data:image/png;base64,ABC');
  assert.strictEqual(sanitizeImageUrl('https://example.com/logo.png'), 'https://example.com/logo.png');
  assert.strictEqual(sanitizeImageUrl('http://insecure.com/logo.png'), '');
  assert.strictEqual(sanitizeImageUrl('javascript:alert(1)'), '');
  assert.strictEqual(sanitizeImageUrl('file:///etc/passwd'), '');
}

console.log('✓ All HTML Escaping & Sanitization tests PASSED!');
