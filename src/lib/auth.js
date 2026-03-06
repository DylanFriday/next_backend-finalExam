import bcrypt from "bcrypt";
import cookie from "cookie";
import jwt from "jsonwebtoken";
import corsHeaders from "@/lib/cors";
import { getClientPromise } from "@/lib/mongodb";
import { NextResponse } from "next/server";

export const ROLES = {
  ADMIN: "ADMIN",
  USER: "USER",
};

export const BOOK_STATUS = {
  ACTIVE: "ACTIVE",
  DELETED: "DELETED",
};

export const BORROW_STATUS = {
  INIT: "INIT",
  CLOSE_NO_AVAILABLE_BOOK: "CLOSE-NO-AVAILABLE-BOOK",
  ACCEPTED: "ACCEPTED",
  CANCEL_ADMIN: "CANCEL-ADMIN",
  CANCEL_USER: "CANCEL-USER",
};

export const JWT_SECRET = process.env.JWT_SECRET || "mydefaulyjwtsecret";
export const DB_NAME =
  process.env.MONGODB_DB || process.env.DB_NAME || "library_management";
export const COLLECTIONS = {
  USERS: process.env.MONGODB_USERS_COLLECTION || "users",
  BOOKS: process.env.MONGODB_BOOKS_COLLECTION || "books",
  BORROWS: process.env.MONGODB_BORROWS_COLLECTION || "borrow_requests",
};

let seedPromise;

export async function getDb() {
  const client = await getClientPromise();
  return client.db(DB_NAME);
}

function unauthorizedResponse() {
  return NextResponse.json(
    { message: "Unauthorized" },
    { status: 401, headers: corsHeaders }
  );
}

function forbiddenResponse() {
  return NextResponse.json(
    { message: "Forbidden" },
    { status: 403, headers: corsHeaders }
  );
}

export function verifyTokenFromCookies(req) {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const parsedCookies = cookie.parse(cookieHeader);
    const token = parsedCookies.token;

    if (!token) {
      return null;
    }

    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export async function ensureTestUsers() {
  if (!seedPromise) {
    seedPromise = (async () => {
      const db = await getDb();
      const users = db.collection(COLLECTIONS.USERS);

      const [adminPasswordHash, userPasswordHash] = await Promise.all([
        bcrypt.hash("admin123", 10),
        bcrypt.hash("user123", 10),
      ]);

      await Promise.all([
        users.updateOne(
          { email: "admin@test.com" },
          {
            $set: {
              username: "admin",
              email: "admin@test.com",
              password: adminPasswordHash,
              firstname: "Admin",
              lastname: "User",
              role: ROLES.ADMIN,
              status: "ACTIVE",
            },
          },
          { upsert: true }
        ),
        users.updateOne(
          { email: "user@test.com" },
          {
            $set: {
              username: "user",
              email: "user@test.com",
              password: userPasswordHash,
              firstname: "Normal",
              lastname: "User",
              role: ROLES.USER,
              status: "ACTIVE",
            },
          },
          { upsert: true }
        ),
      ]);
    })().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }

  return seedPromise;
}

export async function requireAuth(req) {
  const decoded = verifyTokenFromCookies(req);
  if (!decoded) {
    return { error: unauthorizedResponse() };
  }

  return {
    user: {
      id: decoded.id,
      email: decoded.email,
      username: decoded.username,
      role: decoded.role,
    },
  };
}

export async function requireRole(req, allowedRoles = []) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return auth;
  }

  if (!allowedRoles.includes(auth.user.role)) {
    return { error: forbiddenResponse() };
  }

  return auth;
}
