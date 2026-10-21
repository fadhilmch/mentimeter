import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupTestApp, teardownTestApp } from './helpers.js';

let app;
beforeAll(async () => { app = await setupTestApp(); });
afterAll(teardownTestApp);

function directives(header) {
  return Object.fromEntries(
    header.split(';').map((part) => part.trim().split(/\s+/)).filter((p) => p[0]).map(([name, ...values]) => [name, values]),
  );
}

describe('content security policy', () => {
  it('allows slide images from HTTPS but not plain HTTP', async () => {
    const res = await request(app).get('/api/health').expect(200);
    const csp = directives(res.headers['content-security-policy']);
    expect(csp['img-src']).toEqual(["'self'", 'data:', 'https:']);
  });

  it('keeps every other directive at the Helmet default', async () => {
    const res = await request(app).get('/api/health').expect(200);
    const csp = directives(res.headers['content-security-policy']);
    expect(csp['default-src']).toEqual(["'self'"]);
    expect(csp['script-src']).toEqual(["'self'"]);
    expect(csp['object-src']).toEqual(["'none'"]);
    expect(csp['frame-ancestors']).toEqual(["'self'"]);
    expect(csp['connect-src']).toBeUndefined();
    expect(csp['script-src']).not.toContain("'unsafe-inline'");
    expect(csp['img-src']).not.toContain('*');
    expect(csp['img-src']).not.toContain('http:');
  });
});
