# Decipher 🦉

A comforting, interactive app where users navigating trauma and memory loss can log stories with evidence, filling in blanks as they go. Each submission builds a beautiful scrapbook page. An AI owl mentor, **Savid**, asks insightful questions and helps jog memories.

> **Disclaimer:** This app is not a substitute for professional medical or therapeutic advice.

## Structure

| Directory | What |
|-----------|------|
| `app/` | Next.js 16 frontend — landing, auth, dashboard, scrapbook entries, Savid chat, settings |
| `api/` | Express backend — auth, entries CRUD, file uploads, Savid chat, Stripe subscriptions |
| `engine/` | Savid AI engine — personality prompts, conversation logic, crisis detection |
| `design/` | Brand guidelines, CSS theme, design specs |

## Tech Stack
- **Frontend**: Next.js 16, TypeScript, Tailwind CSS, PWA
- **Backend**: Node.js, Express, SQLite (Turso), JWT auth
- **AI**: OpenAI API, custom prompt system, mock mode for dev
- **Payments**: Stripe (7-day trial, $24.99/month, 50% first month)

## Live Preview
https://eb044699c4cc4dada8cc7727a5002ea2.ctonew.app
