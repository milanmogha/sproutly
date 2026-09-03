# Sproutly Web

The responsive web client for Sproutly — all four portals (Parent, Teacher,
Admin, Super Admin) in one Next.js app, talking to the NestJS backend in
`../Backend`.

Built from the Flutter app in `../App` as the functional spec: same flows, same
API contract, same brand — rebuilt for the browser rather than compiled to it.

## Running it

The backend runs on **3000**, so this app runs on **3001**.

```bash
npm install
npm run dev          # http://localhost:3001
```

Point it at a backend in `.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
```

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run build` | Production build |
| `npm start` | Serve the production build on 3001 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | Next's ESLint pass |

## Stack

- **Next.js 15** (App Router) + **React 19** + TypeScript
- **Tailwind CSS v4** — design tokens in `src/app/globals.css`
- **TanStack Query** for server state, **axios** for transport
- **Recharts** for the dashboard charts, **lottie-react** for the splash

## How it's laid out

```
src/
  app/
    page.tsx              role hub (signed-out landing)
    login/[role]/         parent OTP + credential login
    forgot-password/      request a reset link
    reset-password/       from the emailed link
    set-password/         invite activation
    privacy/              the full policy, same text as the app
    parent/   teacher/   admin/   super-admin/
                          one folder per portal, each with its own layout
  components/
    ui/                   the design system (Button, Card, DataList, Modal…)
    layout/               RoleShell, nav config, notification bell
    shared/               screens used by more than one portal
    parent/  admin/       portal-specific pieces
    brand/                logo + splash
  lib/
    api/                  client, endpoints, types, tokens, downloads
    auth/                 session decode, AuthProvider, RequireRole
    payments/             Razorpay checkout
    hooks/  parent/       shared state
```

### Responsiveness

Every screen is one implementation that adapts, not two that diverge:

- **`RoleShell`** is a fixed sidebar from `md` up and a floating pill bottom-nav
  below it — the same navigation the app has, on phones.
- **`DataList`** renders a real `<table>` on desktop and the same rows as cards
  on phones. Screens declare their columns once and get both.
- **`Modal`** is a centred dialog on desktop and a bottom sheet on touch.
- Wide content scrolls inside its own container, so the page body never scrolls
  sideways.

### Auth

JWT pair in `localStorage`, attached by an axios request interceptor. A 401
triggers a **single-flight refresh** and one retry — concurrent 401s share the
same refresh, so a burst can't rotate the token twice. Only a rejected *refresh*
token signs the user out; a network error leaves the session intact.

`RequireRole` gates each portal: a signed-out visitor goes to the hub, and a
signed-in one who wanders into another role's URL is sent back to their own.

### Theming

`data-role` on the shell sets `--accent`, and every component reads it. That's
why the same `<Button>` is grape for parents, aqua for teachers, green for
admins and coral for super admins without a single per-portal prop.

## Payments

Two directions, one helper (`lib/payments/razorpay.ts`):

- **Fees** — parent → school, into the *school's* Razorpay account.
- **Subscription** — school → Sproutly, into the *platform's* account.

The signature POST after checkout is a courtesy, not the settlement: the
backend's webhook is what actually marks an invoice paid, so a failure there is
deliberately not reported as a failed payment.

## Notes

- Push notifications are mobile-only (FCM). The web client polls
  `/notifications/me` instead, which is why the bell refreshes on an interval.
- The **payment gateway** screen is super-admin only, by backend design — a
  school's own admin can neither see nor change its Razorpay keys.
