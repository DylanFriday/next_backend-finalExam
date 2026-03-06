import corsHeaders from "@/lib/cors";
import {
  BORROW_STATUS,
  COLLECTIONS,
  ROLES,
  getDb,
  requireAuth,
  requireRole,
} from "@/lib/auth";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

const BORROW_ALLOWED_STATUSES = Object.values(BORROW_STATUS);

function getObjectId(id) {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  return new ObjectId(id);
}

function canMoveStatus(currentStatus, nextStatus) {
  if (!BORROW_ALLOWED_STATUSES.includes(nextStatus)) {
    return false;
  }

  if (currentStatus === BORROW_STATUS.INIT) {
    return [
      BORROW_STATUS.ACCEPTED,
      BORROW_STATUS.CLOSE_NO_AVAILABLE_BOOK,
      BORROW_STATUS.CANCEL_ADMIN,
      BORROW_STATUS.CANCEL_USER,
    ].includes(nextStatus);
  }

  if (currentStatus === BORROW_STATUS.ACCEPTED) {
    return [BORROW_STATUS.CANCEL_ADMIN, BORROW_STATUS.CANCEL_USER].includes(
      nextStatus
    );
  }

  return false;
}

function toObjectId(value) {
  if (value instanceof ObjectId) {
    return value;
  }
  if (typeof value === "string" && ObjectId.isValid(value)) {
    return new ObjectId(value);
  }
  return null;
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
    const query = {};

    if (auth.user.role !== ROLES.ADMIN) {
      query.userId = auth.user.id;
    }

    const requests = await db
      .collection(COLLECTIONS.BORROWS)
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    const bookIdMap = new Map();
    const uniqueBookObjectIds = [];

    for (const request of requests) {
      const objectId = toObjectId(request.bookId);
      if (!objectId) {
        continue;
      }
      const idKey = objectId.toString();
      if (!bookIdMap.has(idKey)) {
        bookIdMap.set(idKey, null);
        uniqueBookObjectIds.push(objectId);
      }
    }

    if (uniqueBookObjectIds.length > 0) {
      const books = await db
        .collection(COLLECTIONS.BOOKS)
        .find(
          { _id: { $in: uniqueBookObjectIds } },
          { projection: { _id: 1, title: 1 } }
        )
        .toArray();

      for (const book of books) {
        bookIdMap.set(book._id.toString(), {
          _id: book._id,
          title: book.title,
        });
      }
    }

    const response = requests.map((request) => {
      const objectId = toObjectId(request.bookId);
      const book = objectId ? bookIdMap.get(objectId.toString()) || null : null;
      return {
        ...request,
        book,
      };
    });

    return NextResponse.json(response, { headers: corsHeaders });
  } catch {
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(req) {
  const auth = await requireRole(req, [ROLES.USER]);
  if (auth.error) {
    return auth.error;
  }

  try {
    const data = await req.json();
    const { targetDate, bookId } = data;

    if (!targetDate) {
      return NextResponse.json(
        { message: "targetDate is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const targetDateObj = new Date(targetDate);
    if (Number.isNaN(targetDateObj.getTime())) {
      return NextResponse.json(
        { message: "Invalid targetDate" },
        { status: 400, headers: corsHeaders }
      );
    }

    const newRequest = {
      userId: auth.user.id,
      createdAt: new Date(),
      targetDate: targetDateObj,
      requestStatus: BORROW_STATUS.INIT,
    };

    if (bookId !== undefined) {
      newRequest.bookId = bookId;
    }

    const db = await getDb();
    const result = await db.collection(COLLECTIONS.BORROWS).insertOne(newRequest);

    const request = await db
      .collection(COLLECTIONS.BORROWS)
      .findOne({ _id: result.insertedId });

    return NextResponse.json(request, { status: 201, headers: corsHeaders });
  } catch {
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function PATCH(req) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return auth.error;
  }

  try {
    const data = await req.json();
    const { requestId, requestStatus } = data;

    if (!requestId || !requestStatus) {
      return NextResponse.json(
        { message: "requestId and requestStatus are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const objectId = getObjectId(requestId);
    if (!objectId) {
      return NextResponse.json(
        { message: "Invalid requestId" },
        { status: 400, headers: corsHeaders }
      );
    }

    const db = await getDb();
    const borrowRequest = await db
      .collection(COLLECTIONS.BORROWS)
      .findOne({ _id: objectId });

    if (!borrowRequest) {
      return NextResponse.json(
        { message: "Borrow request not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    const isAdmin = auth.user.role === ROLES.ADMIN;
    const isOwner = borrowRequest.userId === auth.user.id;

    if (!isAdmin) {
      if (!isOwner) {
        return NextResponse.json(
          { message: "Forbidden" },
          { status: 403, headers: corsHeaders }
        );
      }

      if (requestStatus !== BORROW_STATUS.CANCEL_USER) {
        return NextResponse.json(
          { message: "Forbidden" },
          { status: 403, headers: corsHeaders }
        );
      }
    } else if (requestStatus === BORROW_STATUS.CANCEL_USER) {
      return NextResponse.json(
        { message: "Admin cannot set CANCEL-USER" },
        { status: 403, headers: corsHeaders }
      );
    }

    if (!canMoveStatus(borrowRequest.requestStatus, requestStatus)) {
      return NextResponse.json(
        { message: "Invalid request status transition" },
        { status: 400, headers: corsHeaders }
      );
    }

    const updated = await db
      .collection(COLLECTIONS.BORROWS)
      .findOneAndUpdate(
        { _id: objectId },
        {
          $set: {
            requestStatus,
            updatedAt: new Date(),
            updatedBy: auth.user.id,
          },
        },
        { returnDocument: "after" }
      );
    const updatedRequest = updated?.value ?? updated;

    return NextResponse.json(updatedRequest, { headers: corsHeaders });
  } catch {
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
