import { type NextRequest } from "next/server";

import { auth } from "@/lib/better-auth";
import { query } from "@/lib/db";
import { ok, problem, serverError } from "@/lib/http";
import type { UserRole } from "@/lib/auth";

type UserRow = {
  id: number;
  auth_user_id: string | null;
  nama: string;
  email: string | null;
  username: string | null;
  role: UserRole;
};

type BetterAuthSignInResult = {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    username?: string;
    role?: UserRole;
  };
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
    };

    if (!body.username || !body.password) {
      return problem("Username dan password wajib diisi.", 400);
    }

    const signIn = (await auth.api.signInUsername({
      body: {
        username: body.username,
        password: body.password,
        rememberMe: true,
      },
      headers: request.headers,
    })) as BetterAuthSignInResult;

    const result = await query<UserRow>(
      `SELECT id, auth_user_id, nama, email, username, role
       FROM users
       WHERE deleted_at IS NULL
         AND (auth_user_id = $1 OR email = $2 OR username = $3)
       ORDER BY auth_user_id = $1 DESC
       LIMIT 1`,
      [
        signIn.user.id,
        signIn.user.email,
        signIn.user.username ?? body.username,
      ],
    );

    let user = result.rows[0];
    if (!user) {
      const insert = await query<UserRow>(
        `INSERT INTO users (auth_user_id, nama, email, username, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, auth_user_id, nama, email, username, role`,
        [
          signIn.user.id,
          signIn.user.name,
          signIn.user.email,
          signIn.user.username ?? body.username,
          signIn.user.role ?? "kasir",
        ],
      );
      user = insert.rows[0];
    } else if (!user.auth_user_id) {
      const update = await query<UserRow>(
        `UPDATE users
         SET auth_user_id = $1
         WHERE id = $2
         RETURNING id, auth_user_id, nama, email, username, role`,
        [signIn.user.id, user.id],
      );
      user = update.rows[0];
    }

    return ok({
      token: signIn.token,
      user,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("invalid")) {
      return problem("Username atau password tidak valid.", 401);
    }
    return serverError(error);
  }
}
