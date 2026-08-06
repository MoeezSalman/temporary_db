# Rua Sadiq API (Next.js)

Express backend ported to **Next.js App Router** API routes. Same MongoDB + GridFS data model, same public paths under `/api/*`.

## Local development

```bash
cd backend-next
cp .env.example .env
# edit MONGO_URI, JWT_SECRET, ADMIN_* 

npm install
npm run dev
# → http://localhost:5000
```

Health check: `GET http://localhost:5000/api/health`

## API surface (compatible with the Vite frontend)

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/health` | public |
| GET | `/api/products?category=&featured=` | public |
| GET | `/api/products/:id` | public |
| POST/PUT/DELETE | `/api/products[/:id]` | admin + multipart |
| GET | `/api/categories` | public |
| POST/PUT/DELETE | `/api/categories[/:id]` | admin + multipart |
| GET | `/api/materials?group=` | public |
| POST/PUT/DELETE | `/api/materials[/:id]` | admin + multipart |
| GET | `/api/site-assets?group=` | public |
| GET | `/api/site-assets/:idOrKey` | public |
| POST/PUT/DELETE | `/api/site-assets[/:id]` | admin + multipart |
| GET | `/api/images/:id` | public (GridFS stream) |
| POST | `/api/admin/login` | public |
| GET | `/api/admin/me` | bearer token |

Admin login accepts:

1. Hardcoded `admin` / `RuaSadiq2024!`
2. `ADMIN_USERNAME` / `ADMIN_PASSWORD` from env
3. DB `Admin` document (bcrypt)

## Deploy on Render

1. Push this folder to a GitHub repo (or monorepo subdirectory).
2. Render → **New → Web Service** → connect repo.
3. Settings:
   - **Root Directory**: `backend-next` (if monorepo)
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Node version**: 20
4. Environment variables:
   - `MONGO_URI` — your Atlas string
   - `JWT_SECRET` — long random string
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD`
   - `FRONTEND_ORIGIN` — e.g. `https://your-app.vercel.app,https://ruasadiq.com`
5. After deploy, note the URL: `https://rua-sadiq-api.onrender.com`

Free tier spins down after idle; first request may take ~30s.

Optional: use `render.yaml` blueprint in this folder.

## Create DB admin

```bash
npm run create-admin
```

(Requires `dotenv` — `npm i dotenv` if missing — and a filled `.env`.)

## Notes

- CORS is handled in `middleware.js`.
- Image uploads use `request.formData()` (no multer).
- GridFS bucket name remains `uploads` (same as old Express app).
- Do **not** commit `.env` with real credentials.
