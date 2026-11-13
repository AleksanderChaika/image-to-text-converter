import assert from 'node:assert/strict';
import net, { type AddressInfo } from 'node:net';
import { describe, it } from 'node:test';

import { ImageAnnotatorClient } from '@google-cloud/vision';
import { grpc } from 'google-gax';

import { HttpError } from './errors';
import { VISION_TIMEOUT_MS, createVisionExtractor, type VisionClient } from './ocr.service';

const IMAGE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GRPC_DEADLINE_EXCEEDED = 4;

async function rejection(promise: Promise<unknown>): Promise<HttpError> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof HttpError, `expected HttpError, got ${String(error)}`);
    return error;
  }
  assert.fail('expected the promise to reject');
}

describe('createVisionExtractor', () => {
  it('passes a 30 second timeout to the Vision call by default', async () => {
    let received: { timeout: number } | undefined;
    const client: VisionClient = {
      documentTextDetection: async (_request, options) => {
        received = options;
        return [{ fullTextAnnotation: { text: 'ok' } }];
      },
    };

    assert.equal(VISION_TIMEOUT_MS, 30_000);
    assert.equal(await createVisionExtractor(() => client)(IMAGE), 'ok');
    assert.deepEqual(received, { timeout: 30_000 });
  });

  it('maps DEADLINE_EXCEEDED to 504 with a safe message', async () => {
    const client: VisionClient = {
      documentTextDetection: async () => {
        throw Object.assign(new Error('4 DEADLINE_EXCEEDED: secret-internal-detail'), {
          code: GRPC_DEADLINE_EXCEEDED,
        });
      },
    };

    const error = await rejection(createVisionExtractor(() => client)(IMAGE));
    assert.equal(error.status, 504);
    assert.equal(error.message, 'Text recognition timed out. Please try again.');
    assert.doesNotMatch(error.message, /secret/);
  });

  it('still maps other Vision errors as before', async () => {
    const make = (code: number): VisionClient => ({
      documentTextDetection: async () => {
        throw Object.assign(new Error('x'), { code });
      },
    });
    assert.equal((await rejection(createVisionExtractor(() => make(14))(IMAGE))).status, 503);
    assert.equal((await rejection(createVisionExtractor(() => make(8))(IMAGE))).status, 429);
    assert.equal((await rejection(createVisionExtractor(() => make(7))(IMAGE))).status, 502);
  });

  it('aborts a real Vision call that never gets a response', async () => {
    const sockets = new Set<net.Socket>();
    const silent = net.createServer((socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    });
    await new Promise<void>((resolve) => silent.listen(0, '127.0.0.1', resolve));
    const { port } = silent.address() as AddressInfo;

    const client = new ImageAnnotatorClient({
      apiEndpoint: '127.0.0.1',
      port,
      sslCreds: grpc.credentials.createInsecure(),
      projectId: 'test-project',
    });

    const originalError = console.error;
    console.error = () => {};
    const startedAt = Date.now();
    try {
      const error = await rejection(
        createVisionExtractor(() => client as unknown as VisionClient, 500)(IMAGE),
      );
      const elapsed = Date.now() - startedAt;

      assert.equal(error.status, 504);
      assert.ok(elapsed >= 400, `finished too early: ${elapsed} ms`);
      assert.ok(elapsed < 5_000, `timeout did not fire in time: ${elapsed} ms`);
    } finally {
      console.error = originalError;
      await client.close();
      sockets.forEach((socket) => socket.destroy());
      silent.close();
    }
  });
});
