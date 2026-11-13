import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import type { Server } from 'node:http';

import { createApp } from './app';
import { HttpError } from './errors';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64),
]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);

describe('POST /api/ocr', () => {
  let server: Server;
  let baseUrl: string;
  let received: Buffer | undefined;
  let failWith: Error | undefined;

  before(async () => {
    const app = createApp(async (image) => {
      received = image;
      if (failWith) throw failWith;
      return 'Hello world';
    });
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  after(() => {
    server.close();
  });

  const post = (data?: Buffer, type = 'image/png', name = 'a.png', field = 'image') => {
    const form = new FormData();
    if (data) form.append(field, new Blob([new Uint8Array(data)], { type }), name);
    return fetch(`${baseUrl}/api/ocr`, { method: 'POST', body: form });
  };

  it('returns recognized text for a PNG and a JPEG', async () => {
    for (const [data, type] of [[PNG, 'image/png'], [JPEG, 'image/jpeg']] as const) {
      failWith = undefined;
      const res = await post(data, type);
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { text: 'Hello world' });
      assert.deepEqual(received, data);
    }
  });

  it('returns 400 when no file is sent', async () => {
    const res = await post();
    assert.equal(res.status, 400);
    assert.match((await res.json()).error.message, /No image provided/);
  });

  it('returns 400 for an unexpected field name', async () => {
    const res = await post(PNG, 'image/png', 'a.png', 'file');
    assert.equal(res.status, 400);
  });

  it('returns 415 for an unsupported MIME type', async () => {
    const res = await post(PNG, 'image/gif', 'a.gif');
    assert.equal(res.status, 415);
  });

  it('returns 415 when the content is not really an image', async () => {
    const res = await post(Buffer.from('not an image at all'), 'image/png');
    assert.equal(res.status, 415);
  });

  it('returns 413 for files larger than 2 MB', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
    const res = await post(big);
    assert.equal(res.status, 413);
    assert.match((await res.json()).error.message, /2 MB/);
  });

  describe('malformed multipart', () => {
    const rawPost = (contentType: string, body: string) =>
      fetch(`${baseUrl}/api/ocr`, { method: 'POST', headers: { 'Content-Type': contentType }, body });

    it('returns 400 when the boundary is missing', async () => {
      const res = await rawPost('multipart/form-data', 'x');
      assert.equal(res.status, 400);
      assert.match((await res.json()).error.message, /Malformed upload request/);
    });

    it('returns 400 when the body ends unexpectedly', async () => {
      const res = await rawPost(
        'multipart/form-data; boundary=XX',
        '--XX\r\nContent-Disposition: form-data; name="image"; filename="a.png"\r\n' +
          'Content-Type: image/png\r\n\r\nabc',
      );
      assert.equal(res.status, 400);
      const body = JSON.stringify(await res.json());
      assert.match(body, /Malformed upload request/);
      assert.doesNotMatch(body, /Boundary|Unexpected end/);
    });

    it('does not change the status of other multer errors', async () => {
      const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
      assert.equal((await post(big)).status, 413);
      assert.equal((await post(PNG, 'image/png', 'a.png', 'file')).status, 400);
    });
  });

  it('propagates service errors with their status', async () => {
    failWith = new HttpError(429, 'Quota exceeded');
    const res = await post(PNG);
    assert.equal(res.status, 429);
    assert.deepEqual(await res.json(), { error: { message: 'Quota exceeded' } });
  });

  it('hides details of unexpected errors', async () => {
    failWith = new Error('secret internal detail');
    const res = await post(PNG);
    assert.equal(res.status, 500);
    assert.doesNotMatch(JSON.stringify(await res.json()), /secret/);
  });

  describe('health endpoints', () => {
    for (const path of ['/', '/api/health']) {
      it(`GET ${path} returns { status: "ok" }`, async () => {
        const res = await fetch(`${baseUrl}${path}`);
        assert.equal(res.status, 200);
        assert.match(res.headers.get('content-type') ?? '', /application\/json/);
        assert.deepEqual(await res.json(), { status: 'ok' });
      });
    }

    it('still returns 404 for unknown routes', async () => {
      const res = await fetch(`${baseUrl}/unknown`);
      assert.equal(res.status, 404);
      assert.deepEqual(await res.json(), { error: { message: 'Not found.' } });
    });
  });

  const corsHeader = async (origin: string) =>
    (await fetch(`${baseUrl}/api/health`, { headers: { Origin: origin } })).headers.get(
      'access-control-allow-origin',
    );

  it('allows local origins on any port', async () => {
    for (const origin of [
      'http://localhost:4200',
      'http://localhost:58049',
      'http://localhost',
      'http://127.0.0.1:5173',
      'http://[::1]:4200',
    ]) {
      assert.equal(await corsHeader(origin), origin, origin);
    }
  });

  it('rejects foreign and look-alike origins', async () => {
    for (const origin of [
      'https://evil.example',
      'http://localhost.evil.com',
      'http://localhost:4200.evil.com',
      'http://localhost:3000@evil.com',
      'https://localhost:4200',
      'http://evil.com:4200',
    ]) {
      assert.equal(await corsHeader(origin), null, origin);
    }
  });

  it('answers the preflight request for an allowed origin', async () => {
    const res = await fetch(`${baseUrl}/api/ocr`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:58049', 'Access-Control-Request-Method': 'POST' },
    });
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:58049');
  });
});
