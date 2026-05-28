# PWA CRM + Employee Activity Tracker

A MERN monorepo implementing a CRM, employee hierarchy, attendance, real-time web-app activity tracking, lead management, reports, exports, notifications, break/leave management, profile onboarding, and role-based dashboards.

## Tech Stack

**Frontend**: React + Vite, Tailwind CSS, React Router, Redux Toolkit, Axios, React Hook Form + Zod, Socket.IO client, PWA manifest/service worker, responsive dashboards.

**Backend**: Node.js, Express, MongoDB/Mongoose, JWT access + refresh sessions, RBAC, Socket.IO, Multer/Cloudinary-ready uploads, Nodemailer, CSV/Excel import, CSV/Excel/PDF export.

## Quick Setup

### 1. Install prerequisites

- Node.js 20+
- MongoDB 7+ running locally or MongoDB Atlas URI

### 2. Install dependencies

```bash
npm run install:all
```

### 3. Configure backend environment

```bash
cp server/.env.example server/.env
```

Update `server/.env` with your MongoDB URI and secure secrets.

### 4. Configure frontend environment

```bash
cp client/.env.example client/.env
```

### 5. Seed demo users

```bash
npm run seed
```

Demo users:

| Role | Email | Password |
|---|---|---|
| Admin | admin@example.com | Admin@123 |
| HR | hr@example.com | Hr@123 |
| Team Leader | tl@example.com | Tl@123 |
| Salesperson | salesperson@example.com | Sales@123 |

### 6. Run development servers

```bash
npm run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:5000

## Production Notes

- Set strong JWT secrets and HTTPS-only cookies behind a reverse proxy.
- Configure SMTP for credential and reset emails.
- Configure Cloudinary credentials or keep local disk uploads behind private storage.
- Use MongoDB indexes already defined in models for scalable querying.
- Deploy backend and frontend separately or serve the frontend build behind Nginx.
- PWA tracks activity inside the CRM browser/PWA only. Desktop activity support is modeled through `activitySource` and can be integrated later with Electron/Tauri.

## Activity Tracking Logic

- Login creates/opens an attendance session.
- Client sends heartbeat every 30 seconds.
- Mouse, keyboard, click, scroll, focus, blur, and visibility events update activity state.
- No interaction for 5 minutes marks user idle.
- Break start/end is separated from idle time.
- Durations are split into inside-shift and outside-shift buckets.
- Socket.IO broadcasts child employee status updates in real time.

## Important API Groups

- `/api/auth/*`
- `/api/users/*`
- `/api/tracking/*`
- `/api/attendance/*`
- `/api/leads/*`
- `/api/break/*`
- `/api/leave/*`
- `/api/reports/*`
- `/api/notifications/*`

## Folder Structure

```text
crm-employee-tracker/
  client/   React PWA frontend
  server/   Express/MongoDB/Socket.IO backend
```
