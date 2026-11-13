import cors from 'cors';
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import multer from 'multer';

import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  UPLOAD_FIELD_NAME,
} from './config';
import { createCorsOptions } from './cors';
import { HttpError } from './errors';
import { hasImageSignature } from './image-signature';
import { type TextExtractor } from './ocr.service';

const MALFORMED_UPLOAD_MESSAGE =
  'Malformed upload request. Send the image as multipart/form-data in the "image" field.';
const UNSUPPORTED_TYPE_MESSAGE = 'Unsupported file format. Please upload a JPG or PNG image.';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new HttpError(415, UNSUPPORTED_TYPE_MESSAGE));
    }
  },
}).single(UPLOAD_FIELD_NAME);

const parseUpload: RequestHandler = (req, res, next) => {
  upload(req, res, (error: unknown) => {
    if (!error || error instanceof multer.MulterError || error instanceof HttpError) {
      next(error);
    } else {
      next(new HttpError(400, MALFORMED_UPLOAD_MESSAGE));
    }
  });
};

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  let status = 500;
  let message = 'Internal server error.';

  if (error instanceof multer.MulterError) {
    status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large. Maximum size is 2 MB.'
        : 'Invalid upload. Send a single image in the "image" field.';
  } else if (error instanceof HttpError) {
    status = error.status;
    message = error.message;
  } else {
    console.error('Unexpected error:', error);
  }

  res.status(status).json({ error: { message } });
};

export function createApp(extractText: TextExtractor) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors(createCorsOptions()));

  const healthHandler: RequestHandler = (_req, res) => {
    res.json({ status: 'ok' });
  };

  app.get('/', healthHandler);
  app.get('/api/health', healthHandler);

  const ocrHandler: RequestHandler = async (req, res) => {
    const file = req.file;
    if (!file) {
      throw new HttpError(400, `No image provided. Send a file in the "${UPLOAD_FIELD_NAME}" field.`);
    }
    if (!hasImageSignature(file.buffer)) {
      throw new HttpError(415, UNSUPPORTED_TYPE_MESSAGE);
    }
    const text = await extractText(file.buffer);
    res.json({ text });
  };

  app.post('/api/ocr', parseUpload, ocrHandler);

  app.use((_req, res) => {
    res.status(404).json({ error: { message: 'Not found.' } });
  });
  app.use(errorHandler);

  return app;
}
