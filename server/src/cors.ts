import type { CorsOptions } from 'cors';

import { EXTRA_ALLOWED_ORIGINS } from './config';

// Только http, только loopback-хосты, любой порт. Якоря ^…$ исключают
// обходы вроде http://localhost.evil.com или http://localhost:3000@evil.com.
const LOCAL_ORIGIN_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/;

export function isOriginAllowed(
  origin: string,
  extraOrigins: readonly string[] = EXTRA_ALLOWED_ORIGINS,
): boolean {
  return LOCAL_ORIGIN_PATTERN.test(origin) || extraOrigins.includes(origin);
}

export function createCorsOptions(extraOrigins: readonly string[] = EXTRA_ALLOWED_ORIGINS): CorsOptions {
  return {
    methods: ['GET', 'POST'],
    origin: (origin, callback) => {
      callback(null, origin !== undefined && isOriginAllowed(origin, extraOrigins));
    },
  };
}
