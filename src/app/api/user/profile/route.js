import corsHeaders from "@/lib/cors";
import { COLLECTIONS, getDb, requireAuth } from "@/lib/auth";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

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
    const profile = await db.collection(COLLECTIONS.USERS).findOne(
      { _id: new ObjectId(auth.user.id) },
      { projection: { password: 0 } }
    );

    return NextResponse.json(profile, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { message: error.toString() },
      { status: 500, headers: corsHeaders }
    );
  }
}
