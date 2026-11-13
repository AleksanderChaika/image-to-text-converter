import { createApp } from './app';
import { PORT } from './config';
import { extractTextWithVision } from './ocr.service';

createApp(extractTextWithVision).listen(PORT, () => {
  console.log(`OCR server listening on http://localhost:${PORT}`);
});
