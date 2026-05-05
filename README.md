# Pricing Waterfall Prototype

A full-stack prototype for managing article pricing (MRP → PTR → PTD → SS Price waterfall), schemes & offers, and bulk pricing uploads.

**Stack:** FastAPI · PostgreSQL · SQLAlchemy (async) · React · Vite · Tailwind CSS v4

---

## Prerequisites

| Tool       | Version  | Install                                      |
|------------|----------|----------------------------------------------|
| Python     | 3.11+    | `brew install python@3.11` or pyenv           |
| Node.js    | 18+      | `brew install node` or nvm                    |
| PostgreSQL | 14+      | `brew install postgresql@16 && brew services start postgresql@16` |

---

## 1. Create the PostgreSQL database

```bash
createdb pricing_prototype
```

By default the backend connects to `postgresql+asyncpg://<your-os-user>@localhost:5432/pricing_prototype`.

To override, set the `DATABASE_URL` environment variable:

```bash
export DATABASE_URL="postgresql+asyncpg://user:password@localhost:5432/pricing_prototype"
```

---

## 2. Backend setup

```bash
cd backend

# Create a virtual environment (recommended)
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the server (tables are auto-created on first boot)
uvicorn app.main:app --reload --port 8000
```

The API is now running at **http://localhost:8000**. Docs at http://localhost:8000/docs.

### Seed sample data (optional but recommended)

In a separate terminal (with the venv activated):

```bash
cd backend
source .venv/bin/activate

python3 -m app.seed                # 5 articles with pricing rules
python3 -m app.seed_distributors   # 4 segments, 15 distributors
python3 -m app.seed_schemes        # 5 sample schemes with slab tiers
```

---

## 3. Frontend setup

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app is now running at **http://localhost:5173**. The Vite dev server proxies `/api/*` requests to the backend on port 8000.

---

## Project structure

```
pricing-prototype/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── database.py          # SQLAlchemy async engine & session
│   │   ├── models.py            # All ORM models
│   │   ├── schemas.py           # Pydantic schemas (articles, pricing)
│   │   ├── scheme_schemas.py    # Pydantic schemas (schemes, distributors)
│   │   ├── pricing.py           # Waterfall computation logic
│   │   ├── seed.py              # Seed articles & pricing rules
│   │   ├── seed_distributors.py # Seed distributor segments & distributors
│   │   ├── seed_schemes.py      # Seed sample schemes with slabs
│   │   └── routes/
│   │       ├── articles.py      # CRUD for articles
│   │       ├── pricing_rules.py # Pricing rule endpoints + simulate
│   │       ├── schemes.py       # Schemes CRUD + toggle
│   │       ├── distributors.py  # Distributor & segment listing
│   │       └── bulk.py          # Bulk upload (template + Excel upload)
│   └── requirements.txt
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx              # Routes & nav
        ├── api.js               # Axios API client
        ├── index.css            # Tailwind import
        ├── pages/
        │   ├── ArticleList.jsx  # Articles table + Bulk Upload tabs
        │   ├── PricingEditor.jsx# Single-SKU pricing editor
        │   ├── SchemeList.jsx   # Scheme listing with filters
        │   ├── SchemeEditor.jsx # Create/edit scheme (slabs, eligibility)
        │   └── BulkUpload.jsx   # Bulk Excel upload panel
        └── components/
            ├── ArticleForm.jsx  # New article form
            └── MarginCard.jsx   # Margin type/base/value card
```

---

## Features

- **Pricing Waterfall** — configure MRP, Retailer Margin, Distributor Margin, and SS/Anchor Margin per article. Live price summary updates as you edit.
- **Schemes & Offers** — Buy X Get Y Free, Amount Off Products, Amount Off Order. Slab-based tiers (up to 10). Target audience: Distributor or Retailer.
- **Eligibility** — All distributors, specific segments, or individual distributors.
- **Bulk Upload** — Download an Excel template, fill in pricing data, upload. Track processing status per file with row-level error details.
- **Search** — Filter articles by SKU/name. Filter schemes by discount type and target audience.
