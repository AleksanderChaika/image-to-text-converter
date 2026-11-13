# Image to Text Converter

A web app that extracts text from images. Upload a JPG or PNG, preview it, recognize the text with Google Cloud Vision, and copy the result to the clipboard.

The Angular frontend talks to a small Express backend, which calls Google Cloud Vision, so Google credentials never reach the browser. Google Cloud Vision is used instead of the example API Ninjas mentioned in the task.

## Live links

| What | URL |
|------|-----|
| Backend API | https://image-to-text-converter-api-94303392854.europe-west3.run.app |
| Health check | https://image-to-text-converter-api-94303392854.europe-west3.run.app/api/health (returns `{"status":"ok"}`) |
| Frontend | _Not published yet. The public link will be added here._ |

The backend is deployed on Google Cloud Run. The frontend in this repository is already configured to use it (see [Configuration](#configuration)).

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
Browser (Angular) ── POST /api/ocr ──> Express (Cloud Run or :3000) ──> Google Cloud Vision
```

## How OCR works

1. The browser validates the file (JPG/PNG, up to 2 MB) and sends it to `POST /api/ocr` as `multipart/form-data`, field `image`.
2. The backend re-checks size, MIME type and file signature, keeping the image in memory only.
3. It calls Google Cloud Vision `documentTextDetection` through `@google-cloud/vision`, with a 30-second deadline.
4. The recognized text is returned as `{ "text": "..." }`, and the frontend shows it with a **Copy Text** button.

Authentication to Vision uses Application Default Credentials: your own `gcloud` login locally, and the service's runtime service account on Cloud Run. No key files are used or stored in the repository.

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

By default the frontend talks to the Cloud Run backend, so the frontend alone is enough to try the app (Google Cloud setup is needed only to run your own backend). To use the local backend, set `apiUrl` in `src/environments/environment.ts` to `http://localhost:3000`.

## Configuration

Backend variables are read from the shell environment (`.env` files are **not** loaded; `server/.env.example` only lists them):

| Variable       | Default | Description |
|----------------|---------|-------------|
| `PORT`         | `3000`  | Backend port, e.g. `PORT=3001 npm run dev` |
| `CORS_ORIGINS` | empty   | Extra allowed origins, comma-separated. `localhost`, `127.0.0.1` and `[::1]` on any port are always allowed. |

The frontend reads the backend address from `apiUrl` in `src/environments/environment.ts` (currently the Cloud Run URL above, without a trailing slash); change it to use a local backend or if you change `PORT`. The frontend tests use the same value, so they pass with any `apiUrl`.

On Cloud Run, `PORT` is set by the platform. When the frontend is published, add its origin (for example `https://your-frontend.example`, no path or trailing slash) to `CORS_ORIGINS` on the Cloud Run service. Only `localhost`, `127.0.0.1` and `[::1]` over `http` are allowed by default.

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

The browser request times out after 35 seconds. The backend has no authentication or rate limiting and listens on all network interfaces. Each recognition request is billed by Google Cloud Vision, so limit the Cloud Run `max-instances` and set a billing budget alert if the backend is publicly reachable.

## Troubleshooting

- **"Cannot reach the server":** the backend is not running, uses another port (update `apiUrl`), or needs a restart. Check `<apiUrl>/api/health`, for example http://localhost:3000/api/health for a local backend.
- **CORS error:** the page origin is not allowed; add it via `CORS_ORIGINS`.
- **`502` "not authorized…":** run `gcloud auth application-default login`, enable the Vision API and billing. If the log mentions a quota project, run `gcloud auth application-default set-quota-project YOUR_PROJECT_ID`.
- **`EADDRINUSE`:** the port is busy; free it or use another `PORT` and update `apiUrl`.
- **Install or build errors:** check `node -v` against the supported range.
- **"Copy failed":** the Clipboard API needs `localhost` or HTTPS; copy the text manually.
