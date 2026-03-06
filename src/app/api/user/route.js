import corsHeaders from "@/lib/cors";
import { COLLECTIONS, getDb } from "@/lib/auth";
import bcrypt from "bcrypt";
import { NextResponse } from "next/server";

export async function POST(req) {
  const data = await req.json();
  const username = data.username;
  const email = data.email;
  const password = data.password;
  const firstname = data.firstname;
  const lastname = data.lastname;

  if (!username || !email || !password) {
    return NextResponse.json(
      { message: "Missing mandatory data" },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const db = await getDb();
    const result = await db.collection(COLLECTIONS.USERS).insertOne({
      username,
      email,
      password: await bcrypt.hash(password, 10),
      firstname,
      lastname,
      role: "USER",
      status: "ACTIVE",
    });

    return NextResponse.json(
      { id: result.insertedId },
      { status: 200, headers: corsHeaders }
    );
  } catch (exception) {
    const errorMsg = exception.toString();
    let displayErrorMsg = "";
    if (errorMsg.includes("duplicate")) {
      if (errorMsg.includes("username")) {
        displayErrorMsg = "Duplicate Username!!";
      } else if (errorMsg.includes("email")) {
        displayErrorMsg = "Duplicate Email!!";
      }
    }

    return NextResponse.json(
      { message: displayErrorMsg || "Invalid data" },
      { status: 400, headers: corsHeaders }
    );
  }
}
