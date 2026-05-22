# WorkProof AI

WorkProof AI is a Stage 1 prototype for onboarding and task tracking. It lets a manager assign tasks, an employee track work sessions and evidence, and both sides review manager recommendations/history and final reports.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma
- SQLite

## Features Completed

- Manager dashboard
- Employee dashboard
- Task assignment
- Task detail page
- Work session timer
- 50-minute break reminder
- Progress notes
- Proof links
- Submit for review
- Manager approve/request changes
- Recommendation history
- Final task report
- Automatic demo data creation when the database is empty

## Getting Started

Install dependencies:

```bash
npm install
```

Create your local environment file:

```bash
copy .env.example .env
```

Create the local SQLite database and generate Prisma client:

```bash
npm run db:push
npm run db:generate
```

Run the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

If port `3000` keeps running after closing the terminal:

```bash
npm run stop
```

## Demo Data

The app automatically creates demo records if the database is empty:

- Manager: `manager@workproof.ai`
- Employee: `employee@workproof.ai`
- One onboarding checklist task

## Main Routes

- `/`
- `/manager`
- `/employee`
- `/tasks/[id]`
- `/tasks/[id]/review`
- `/tasks/[id]/report`

## Next Steps

- Add real authentication
- Add task edit/delete/filtering
- Improve reports and export to PDF/CSV
- Replace mock AI summary with real AI generation
- Add role-based permissions
