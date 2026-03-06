import corsHeaders from "@/lib/cors";
import {
  BOOK_STATUS,
  COLLECTIONS,
  ROLES,
  getDb,
  requireAuth,
  requireRole,
} from "@/lib/auth";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

function getObjectId(id) {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  return new ObjectId(id);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET(req, { params }) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return auth.error;
  }

  const resolvedParams = await params;
  const objectId = getObjectId(resolvedParams?.id);
  if (!objectId) {
    return NextResponse.json(
      { message: "Invalid book id" },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const db = await getDb();
    const book = await db.collection(COLLECTIONS.BOOKS).findOne({ _id: objectId });

    if (!book) {
      return NextResponse.json(
        { message: "Book not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    if (auth.user.role !== ROLES.ADMIN && book.status === BOOK_STATUS.DELETED) {
      return NextResponse.json(
        { message: "Book not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(book, { headers: corsHeaders });
  } catch {
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function PATCH(req, { params }) {
  const auth = await requireRole(req, [ROLES.ADMIN]);
  if (auth.error) {
    return auth.error;
  }

  const resolvedParams = await params;
  const objectId = getObjectId(resolvedParams?.id);
  if (!objectId) {
    return NextResponse.json(
      { message: "Invalid book id" },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const data = await req.json();
    const allowed = ["title", "author", "quantity", "location", "status"];
    const updateData = {};

    for (const field of allowed) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { message: "No updatable fields provided" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (updateData.quantity !== undefined) {
      const parsedQuantity = Number(updateData.quantity);
      if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
        return NextResponse.json(
          { message: "Quantity must be a non-negative number" },
          { status: 400, headers: corsHeaders }
        );
      }
      updateData.quantity = parsedQuantity;
    }

    if (
      updateData.status !== undefined &&
      updateData.status !== BOOK_STATUS.ACTIVE &&
      updateData.status !== BOOK_STATUS.DELETED
    ) {
      return NextResponse.json(
        { message: "Invalid status" },
        { status: 400, headers: corsHeaders }
      );
    }

    updateData.updatedAt = new Date();

    const db = await getDb();
    const result = await db
      .collection(COLLECTIONS.BOOKS)
      .findOneAndUpdate(
        { _id: objectId },
        { $set: updateData },
        { returnDocument: "after" }
      );
    const updatedBook = result?.value ?? result;

    if (!updatedBook) {
      return NextResponse.json(
        { message: "Book not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(updatedBook, { headers: corsHeaders });
  } catch {
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function DELETE(req, { params }) {
  const auth = await requireRole(req, [ROLES.ADMIN]);
  if (auth.error) {
    return auth.error;
  }

  const resolvedParams = await params;
  const objectId = getObjectId(resolvedParams?.id);
  if (!objectId) {
    return NextResponse.json(
      { message: "Invalid book id" },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const db = await getDb();
    const result = await db
      .collection(COLLECTIONS.BOOKS)
      .findOneAndUpdate(
        { _id: objectId },
        {
          $set: {
            status: BOOK_STATUS.DELETED,
            updatedAt: new Date(),
            deletedAt: new Date(),
          },
        },
        { returnDocument: "after" }
      );
    const deletedBook = result?.value ?? result;

    if (!deletedBook) {
      return NextResponse.json(
        { message: "Book not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { message: "Book deleted", book: deletedBook },
      { headers: corsHeaders }
    );
  } catch {
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
