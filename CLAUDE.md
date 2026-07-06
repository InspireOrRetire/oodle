# Oodle — Claude Code settings

## Allowed tools

The following tools are pre-approved and should never prompt for permission:

- Bash
- Read
- Edit
- Write

## Project context

- Stack: React + TypeScript + Vite, Supabase (auth, DB, edge functions), Tailwind, Framer Motion
- Deploy: Vercel auto-deploys from `main` branch
- Git workflow: commit on `dev` → push dev → merge into `main` → push main → switch back to dev
- Primary working directory: `/Users/donlike/Developer/oodle`
