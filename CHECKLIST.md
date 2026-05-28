# Built Feature Checklist

## Core Architecture
- [x] MERN monorepo with `client` and `server`
- [x] React + Vite frontend
- [x] Tailwind CSS UI system
- [x] Node.js + Express backend
- [x] MongoDB + Mongoose models
- [x] Socket.IO real-time layer
- [x] PWA support with manifest/service worker config
- [x] Mobile-first responsive layout with desktop sidebar and mobile bottom navigation

## Authentication & Security
- [x] JWT access token login
- [x] Refresh token session handling with HTTP-only cookie
- [x] Logout with refresh-token revocation
- [x] First-login password change flow
- [x] Forgot/reset password flow
- [x] Role-based access control middleware
- [x] Ownership/hierarchy checks for users, leads and attendance
- [x] Helmet, CORS, rate limiting and centralized error handling

## Roles & Hierarchy
- [x] Admin role
- [x] HR role
- [x] Team Leader role
- [x] Salesperson role
- [x] Parent-child assignment model
- [x] Admin can access all dashboards/reports
- [x] HR can access assigned Team Leaders and Salespersons
- [x] Team Leader can access assigned Salespersons only
- [x] Salesperson can access own data only

## Employee Management
- [x] Admin/HR employee creation
- [x] Role-specific HR/TL/Salesperson assignment
- [x] Unique employee/HR/TL ID generation
- [x] Default password credential email support via Nodemailer
- [x] Profile completion percentage
- [x] Mandatory profile fields
- [x] Optional documents model
- [x] HR/Admin profile verification
- [x] Employee deactivate/delete workflow

## Activity & Attendance Tracking
- [x] Attendance session on login
- [x] Heartbeat tracking every 30 seconds from frontend
- [x] Mouse, keyboard, click, scroll, focus, blur and visibility detection
- [x] Idle detection after 5 minutes
- [x] Offline/disconnected handling
- [x] Active/Idle/On Break/Offline states
- [x] Working-hour active time split
- [x] Out-of-shift active time split
- [x] Break time separated from idle time
- [x] CRM PWA vs future desktop tracker activity source support
- [x] Real-time child employee status updates with Socket.IO

## ChildEmployeeTracker
- [x] Reusable `ChildEmployeeTracker` component
- [x] Admin sees HR, Team Leaders and Salespersons
- [x] HR sees assigned Team Leaders and Salespersons
- [x] Team Leader sees assigned Salespersons
- [x] Shows employee name, ID, role and assigned parent
- [x] Shows online/offline/activity status
- [x] Shows login/logout, assigned shift, active, idle, break and out-of-shift time
- [x] Shows today lead stats and performance percentage
- [x] Search/filter support

## Lead Management
- [x] Manual lead creation
- [x] CSV/Excel lead upload
- [x] Salesperson self-generated leads with reward eligibility
- [x] Lead assignment
- [x] Search leads by text fields
- [x] Lead type, call status, action required and pipeline fields
- [x] Kanban-style pipeline drag/drop
- [x] Duplicate detection by phone, email, company and website
- [x] Timeline entries for create, assign, update, status change, completion and delete
- [x] Team Leader delete-own-team-leads rule
- [x] Salesperson cannot delete leads

## Reports & Exports
- [x] Dashboard analytics API
- [x] Lead report
- [x] Attendance/active-hours report
- [x] Team/salesperson performance report
- [x] Break/leave report service
- [x] CSV export
- [x] Excel export
- [x] PDF export
- [x] Date/employee/status filters foundation

## Notifications
- [x] Notification model and API
- [x] Real-time Socket.IO notifications
- [x] Notification bell UI
- [x] Mark one/read-all support
- [x] Notification history page
- [x] Email notification utility support

## Break & Leave
- [x] Start break
- [x] End break
- [x] Break reason/type/duration
- [x] Leave request
- [x] HR/Admin approve/reject leave
- [x] Leave notifications

## Seed Data
- [x] Admin: admin@example.com / Admin@123
- [x] HR: hr@example.com / Hr@123
- [x] Team Leader: tl@example.com / Tl@123
- [x] Salesperson: salesperson@example.com / Sales@123
- [x] Seed leads
