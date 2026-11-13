import { ImageAnnotatorClient, protos } from '@google-cloud/vision';

import { HttpError } from './errors';

export type TextExtractor = (image: Buffer) => Promise<string>;

export const VISION_TIMEOUT_MS = 30_000;

const GRPC_INVALID_ARGUMENT = 3;
const GRPC_DEADLINE_EXCEEDED = 4;
const GRPC_PERMISSION_DENIED = 7;
const GRPC_RESOURCE_EXHAUSTED = 8;
const GRPC_UNAVAILABLE = 14;
const GRPC_UNAUTHENTICATED = 16;

let client: ImageAnnotatorClient | undefined;

function getClient(): ImageAnnotatorClient {
  client ??= new ImageAnnotatorClient();
  return client;
}

function toHttpError(error: unknown): HttpError {
  const code = (error as { code?: number } | null)?.code;
  console.error('Google Cloud Vision error:', error);

  switch (code) {
    case GRPC_INVALID_ARGUMENT:
      return new HttpError(422, 'The image could not be processed. Try a different image.');
    case GRPC_RESOURCE_EXHAUSTED:
      return new HttpError(429, 'The text recognition quota has been exceeded. Try again later.');
    case GRPC_PERMISSION_DENIED:
    case GRPC_UNAUTHENTICATED:
      return new HttpError(
        502,
        'The server is not authorized to use the text recognition service. Check the Google Cloud configuration (credentials, API access, billing).',
      );
    case GRPC_DEADLINE_EXCEEDED:
      return new HttpError(504, 'Text recognition timed out. Please try again.');
    case GRPC_UNAVAILABLE:
      return new HttpError(503, 'The text recognition service is temporarily unavailable. Try again later.');
    default:
      return new HttpError(502, 'Text recognition failed. Please try again.');
  }
}

/**
 * Минимальный интерфейс клиента. Типы SDK объявляют `documentTextDetection(request)` с одним
 * аргументом, но реализация (helpers.js) принимает вторым аргументом gax CallOptions
 * и передаёт их в batchAnnotateImages — поэтому тип описан здесь явно.
 */
export interface VisionClient {
  documentTextDetection(
    request: { image: { content: Buffer } },
    options: { timeout: number },
  ): Promise<[protos.google.cloud.vision.v1.IAnnotateImageResponse, ...unknown[]]>;
}

export function createVisionExtractor(
  getVisionClient: () => VisionClient,
  timeoutMs: number = VISION_TIMEOUT_MS,
): TextExtractor {
  return async (image) => {
    try {
      const [result] = await getVisionClient().documentTextDetection(
        { image: { content: image } },
        { timeout: timeoutMs },
      );

      if (result.error?.message) {
        console.error('Google Cloud Vision per-image error:', result.error);
        throw new HttpError(422, 'The image could not be processed. Try a different image.');
      }
      return result.fullTextAnnotation?.text ?? '';
    } catch (error) {
      throw error instanceof HttpError ? error : toHttpError(error);
    }
  };
}

export const extractTextWithVision: TextExtractor = createVisionExtractor(
  () => getClient() as unknown as VisionClient,
);
