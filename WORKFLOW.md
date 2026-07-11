# Decipher — Team Code Workflow

## Repository
- **URL**: https://github.com/nefertirimcbusiness-oss/decipher
- **Default branch**: `main`

## Project Structure
```
decipher/
├── app/          # Frontend (Next.js) — from decipher-app/
├── api/          # Backend (Express) — from decipher-api/
├── engine/       # Savid AI engine — from savid-engine/
├── design/       # Design assets and specs
└── README.md
```

## Branch Strategy
- `main` — production-ready code only
- Feature branches: `feat/<description>` for new work
- Pull requests required for all merges to `main`

## Code Delivery
- Frontend engineer pushes to `app/`
- Backend engineer pushes to `api/`
- AI engineer pushes to `engine/`
- Lead reviews and merges PRs
