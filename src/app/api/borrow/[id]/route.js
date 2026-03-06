import {
  COLLECTIONS,
  ROLES,
  getDb,
  verifyTokenFromCookies,
} from "@/lib/auth";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

const borrowPatchCorsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:5173",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const allowedBorrowStatuses = new Set([
  "INIT",
  "CLOSE-NO-AVAILABLE-BOOK",
  "ACCEPTED",
  "CANCEL-ADMIN",
  "CANCEL-USER",
]);

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: borrowPatchCorsHeaders,
  });
}

export async function PATCH(req, { params }) {
  const user = verifyTokenFromCookies(req);

  if (!user) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401, headers: borrowPatchCorsHeaders }
    );
  }

  if (user.role !== ROLES.ADMIN) {
    return NextResponse.json(
      { message: "Forbidden" },
      { status: 403, headers: borrowPatchCorsHeaders }
    );
  }

  const resolvedParams = await params;
  const id = resolvedParams?.id;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json(
      { message: "Invalid borrow request id" },
      { status: 400, headers: borrowPatchCorsHeaders }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body" },
      { status: 400, headers: borrowPatchCorsHeaders }
    );
  }

  const requestStatusRaw = body?.requestStatus;
  const requestStatus =
    typeof requestStatusRaw === "string" ? requestStatusRaw.trim() : "";

  if (!allowedBorrowStatuses.has(requestStatus)) {
    return NextResponse.json(
      { message: "Invalid request status" },
      { status: 400, headers: borrowPatchCorsHeaders }
    );
  }

  try {
    const db = await getDb();
    const objectId = new ObjectId(id);

    const updateResult = await db
      .collection(COLLECTIONS.BORROWS)
      .findOneAndUpdate(
        { _id: objectId },
        {
          $set: {
            requestStatus,
            updatedAt: new Date(),
            updatedBy: user.id,
          },
        },
        { returnDocument: "after" }
      );

    const updatedBorrowRequest = updateResult?.value ?? updateResult;

    if (!updatedBorrowRequest) {
      return NextResponse.json(
        { message: "Borrow request not found" },
        { status: 404, headers: borrowPatchCorsHeaders }
      );
    }

    return NextResponse.json(updatedBorrowRequest, {
      status: 200,
      headers: borrowPatchCorsHeaders,
    });
  } catch {
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500, headers: borrowPatchCorsHeaders }
    );
  }
}
