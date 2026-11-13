import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isOriginAllowed } from './cors';

describe('isOriginAllowed', () => {
  it('honours explicit extra origins (CORS_ORIGINS)', () => {
    assert.equal(isOriginAllowed('https://app.example.com', ['https://app.example.com']), true);
    assert.equal(isOriginAllowed('https://app.example.com', []), false);
  });

  it('never allows a wildcard-like or empty origin', () => {
    assert.equal(isOriginAllowed('*', []), false);
    assert.equal(isOriginAllowed('null', []), false);
    assert.equal(isOriginAllowed('', []), false);
  });
});
