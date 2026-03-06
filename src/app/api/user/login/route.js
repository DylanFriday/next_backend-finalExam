import corsHeaders from "@/lib/cors";
import {
  COLLECTIONS,
  ensureTestUsers,
  getDb,
  JWT_SECRET,
} from "@/lib/auth";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(req) {
  const data = await req.json();
  const { email, password } = data;

  if (!email || !password) {
    return NextResponse.json(
      { message: "Missing email or password" },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    await ensureTestUsers();

    const db = await getDb();
    const user = await db.collection(COLLECTIONS.USERS).findOne({ email });

    if (!user) {
      return NextResponse.json(
        { message: "Invalid email or password" },
        { status: 401, headers: corsHeaders }
      );
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return NextResponse.json(
        { message: "Invalid email or password" },
        { status: 401, headers: corsHeaders }
      );
    }

    const token = jwt.sign(
      {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        role: user.role || "USER",
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const response = NextResponse.json(
      {
        message: "Login successful",
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          role: user.role || "USER",
        },
      },
      {
        status: 200,
        headers: corsHeaders,
      }
    );

    response.cookies.set("token", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch {
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
