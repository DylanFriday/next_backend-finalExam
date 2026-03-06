# Library Management Backend (Next.js + MongoDB)

Backend API for a Library Management System built with Next.js App Router API routes and MongoDB.

## Tech Stack

- Next.js (App Router, Route Handlers)
- MongoDB (native driver)
- JWT authentication (stored in HTTP-only cookie)
- bcrypt for password hashing

## Features

- Cookie-based JWT authentication
- Role-based authorization (`ADMIN`, `USER`)
- Book management with soft delete
- Borrow request workflow with status validation
- CORS support for frontend at `http://localhost:5173`

## Environment Variables

Create `.env.local` with:

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
ADMIN_SETUP_PASS=optional_setup_pass

# Optional overrides
# MONGODB_DB=library_management
# MONGODB_USERS_COLLECTION=users
# MONGODB_BOOKS_COLLECTION=books
# MONGODB_BORROWS_COLLECTION=borrow_requests
```

## Installation & Run

```bash
npm install
npm run dev
```

Server default: `http://localhost:3000`

## Authentication

- Login sets JWT in cookie `token` (HTTP-only).
- Protected endpoints read and verify JWT from request cookies.
- No localStorage/Bearer token auth is used.

Cookie settings:

- `httpOnly: true`
- `sameSite: "lax"`
- `path: "/"`
- `maxAge: 60 * 60 * 24 * 7`
- `secure: process.env.NODE_ENV === "production"`

## Default Test Users

These users are seeded/ensured in backend logic:

- `ADMIN` - `admin@test.com` / `admin123`
- `USER` - `user@test.com` / `user123`

## API Endpoints

### User

- `POST /api/user` - Register user (default role `USER`)
- `POST /api/user/login` - Login and set JWT cookie
- `POST /api/user/logout` - Clear JWT cookie
- `GET /api/user/profile` - Get current user profile (auth required)

### Books

- `GET /api/books` - List books (auth required)
  - Query params: `title`, `author` (case-insensitive)
  - USER cannot see soft-deleted books
- `POST /api/books` - Create book (ADMIN only)
- `GET /api/books/:id` - Get book by id (auth required)
- `PATCH /api/books/:id` - Update book (ADMIN only)
- `DELETE /api/books/:id` - Soft delete book (ADMIN only)

Book fields:

- `title`
- `author`
- `quantity`
- `location`
- `status` (`ACTIVE` / `DELETED`)

### Borrow Requests

- `GET /api/borrow` - List requests (auth required)
  - ADMIN: all requests
  - USER: only own requests
  - Includes joined `book` object when available: `{ _id, title }`
- `POST /api/borrow` - Create request (USER only)
- `PATCH /api/borrow` - Legacy update flow by body (`requestId`, `requestStatus`)
- `PATCH /api/borrow/:id` - Admin status update flow (recommended)
- `OPTIONS /api/borrow/:id` - CORS preflight handler

Borrow request statuses:

- `INIT`
- `CLOSE-NO-AVAILABLE-BOOK`
- `ACCEPTED`
- `CANCEL-ADMIN`
- `CANCEL-USER`

### Admin Utility

- `GET /admin/initial?pass=...` - Ensure DB indexes

## Authorization Rules

- Unauthenticated access: `401 Unauthorized`
- Authenticated but forbidden action: `403 Forbidden`

Role restrictions:

- Only `ADMIN` can create/update/delete books.
- Only `USER` can create borrow requests.
- `PATCH /api/borrow/:id` requires `ADMIN`.

## Error Handling

The API returns proper status codes for invalid operations:

- `400` invalid input/body/status/id format
- `401` missing/invalid auth token
- `403` insufficient permissions
- `404` resource not found
- `500` unexpected server error

## Build

```bash
npm run build
npm start
```
