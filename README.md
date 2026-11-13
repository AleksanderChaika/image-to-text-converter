# Image to Text Converter

A web app that extracts text from images. Upload a JPG or PNG, preview it, recognize the text with Google Cloud Vision, and copy the result to the clipboard.

The Angular frontend talks to a small Express backend, which calls Google Cloud Vision, so Google credentials never reach the browser. Google Cloud Vision is used instead of the example API Ninjas mentioned in the task.

## Features

- Upload via file dialog or drag & drop; JPG, JPEG and PNG only, up to 2 MB (checked in the browser and on the server)
- Image preview with remove / replace
- Text recognition with Google Cloud Vision (`documentTextDetection`)
- Result shown on the page with a **Copy Text** button (Clipboard API)
- Loading state, clear error messages, request timeouts and retry

## Tech stack

- **Frontend:** Angular 21, TypeScript, SCSS, standalone components, signals, RxJS
- **Backend:** Node.js, Express 5, TypeScript, Multer (in-memory), CORS
- **OCR:** `@google-cloud/vision` with Application Default Credentials (ADC)
- **Tests:** Vitest (Angular unit-test builder) and Node's built-in test runner via `tsx`

```
Browser (Angular :4200) ── POST /api/ocr ──> Express (:3000) ──> Google Cloud Vision
```

Frontend code lives in `src/app` (`core/` for services and validation, `features/converter/` for the page and its components), backend code in `server/src`. Images are processed in memory and never written to disk.

## Requirements

- **Node.js** `^22.12.0 || >=24.0.0` (Node.js 23 is not supported) and npm
- **Google Cloud CLI** (`gcloud`)
- A **Google Cloud project with billing enabled** (the Vision API is paid, with a free monthly allowance)

## Google Cloud setup

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable vision.googleapis.com
gcloud auth application-default login
gcloud auth application-default print-access-token > /dev/null && echo "ADC OK"   # verify
```

No key files are needed. Never commit credentials or `.env` files; `.gitignore` excludes them.

## Installation

```bash
npm ci
cd server && npm ci
```

## Running

Use two terminals.

```bash
# Terminal 1: backend, http://localhost:3000
cd server
npm run dev

# Terminal 2: frontend, http://localhost:4200 (from the project root)
npm start
```

Open http://localhost:4200, choose or drop an image and click **Extract Text**.
To run the compiled backend instead: `cd server && npm run build && npm start`.

## Configuration

Backend variables are read from the shell environment (`.env` files are **not** loaded; `server/.env.example` only lists them):

| Variable       | Default | Description |
|----------------|---------|-------------|
| `PORT`         | `3000`  | Backend port, e.g. `PORT=3001 npm run dev` |
| `CORS_ORIGINS` | empty   | Extra allowed origins, comma-separated. `localhost`, `127.0.0.1` and `[::1]` on any port are always allowed. |

The frontend reads the backend address from `apiUrl` in `src/environments/environment.ts` (default `http://localhost:3000`); update it if you change `PORT`.

## Tests and build

```bash
npm test -- --watch=false     # frontend tests (project root)
npm run build                 # frontend production build -> dist/

cd server
npm test                      # backend tests
npm run build                 # backend build -> server/dist/
```

## API

`GET /` and `GET /api/health` return `{ "status": "ok" }`.

`POST /api/ocr` takes `multipart/form-data` with one JPEG or PNG (max 2 MB) in the `image` field:

```bash
curl -X POST http://localhost:3000/api/ocr -F "image=@/path/to/image.png;type=image/png"
```

Success (`200`), with an empty `text` if nothing was found:

```json
{ "text": "Hello OCR World\nImage to Text 2026" }
```

Errors share one shape, `{ "error": { "message": "..." } }`:

| Status | Meaning |
|--------|---------|
| `400`  | No file, wrong field name, more than one file, or malformed multipart request |
| `413`  | File larger than 2 MB |
| `415`  | Not a JPG/PNG (checked by MIME type and file signature) |
| `422`  | Google Cloud Vision could not process the image |
| `429`  | Vision quota exceeded |
| `500`  | Unexpected server error |
| `502`  | Recognition failed, or the server is not authorized to use Vision |
| `503`  | Vision temporarily unavailable |
| `504`  | Vision did not respond within 30 seconds |

Unknown routes return `404`. Internal details and credentials are never sent to the client, only logged on the server.

## Limitations

The browser request times out after 35 seconds. The backend has no authentication or rate limiting and listens on all network interfaces, so it is meant for local use, not public deployment.

## Troubleshooting

- **"Cannot reach the server":** the backend is not running, uses another port (update `apiUrl`), or needs a restart. Check http://localhost:3000/api/health.
- **CORS error:** the page origin is not allowed; add it via `CORS_ORIGINS`.
- **`502` "not authorized…":** run `gcloud auth application-default login`, enable the Vision API and billing. If the log mentions a quota project, run `gcloud auth application-default set-quota-project YOUR_PROJECT_ID`.
- **`EADDRINUSE`:** the port is busy; free it or use another `PORT` and update `apiUrl`.
- **Install or build errors:** check `node -v` against the supported range.
- **"Copy failed":** the Clipboard API needs `localhost` or HTTPS; copy the text manually.
