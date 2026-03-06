import corsHeaders from "@/lib/cors";
import {
  BOOK_STATUS,
  COLLECTIONS,
  ROLES,
  getDb,
  requireAuth,
  requireRole,
} from "@/lib/auth";
import { NextResponse } from "next/server";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET(req) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return auth.error;
  }

  try {
    const db = await getDb();
    const { searchParams } = new URL(req.url);
    const title = searchParams.get("title");
    const author = searchParams.get("author");

    const query = {};

    if (title) {
      query.title = { $regex: escapeRegex(title), $options: "i" };
    }

    if (author) {
      query.author = { $regex: escapeRegex(author), $options: "i" };
    }

    if (auth.user.role !== ROLES.ADMIN) {
      query.status = { $ne: BOOK_STATUS.DELETED };
    }

    const books = await db
      .collection(COLLECTIONS.BOOKS)
      .find(query)
      .sort({ _id: -1 })
      .toArray();

    return NextResponse.json(books, { headers: corsHeaders });
  } catch {
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(req) {
  const auth = await requireRole(req, [ROLES.ADMIN]);
  if (auth.error) {
    return auth.error;
  }

  try {
    const data = await req.json();
    const { title, author, quantity, location } = data;

    if (
      !title ||
      !author ||
      quantity === undefined ||
      quantity === null ||
      !location
    ) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400, headers: corsHeaders }
      );
    }

    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
      return NextResponse.json(
        { message: "Quantity must be a non-negative number" },
        { status: 400, headers: corsHeaders }
      );
    }

    const db = await getDb();
    const result = await db.collection(COLLECTIONS.BOOKS).insertOne({
      title,
      author,
      quantity: parsedQuantity,
      location,
      status: BOOK_STATUS.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const book = await db
      .collection(COLLECTIONS.BOOKS)
      .findOne({ _id: result.insertedId });

    return NextResponse.json(book, { status: 201, headers: corsHeaders });
  } catch {
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
