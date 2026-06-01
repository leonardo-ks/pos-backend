import type { NextRequest } from "next/server";

import { auth } from "./better-auth";
import { query } from "./db";

export type UserRole = string;

export type AuthUser = {
  id: number;
  auth_user_id: string | null;
  nama: string;
  email: string | null;
  username: string | null;
  role: UserRole;
};

type UserRow = AuthUser;
const permissionCache = new Map<string, { allowed: boolean; expiresAt: number }>();
const permissionCacheTtlMs = 30_000;

type BetterAuthSession = {
  user: {
    id: string;
    name: string;
    email: string;
    username?: string;
    role?: UserRole;
  };
};

export async function getCurrentUser(request: NextRequest) {
  const session = (await auth.api.getSession({
    headers: request.headers,
  })) as BetterAuthSession | null;

  if (session?.user.email) {
    const result = await query<UserRow>(
      `SELECT id, auth_user_id, nama, email, username, role
       FROM users
       WHERE deleted_at IS NULL
         AND (auth_user_id = $1 OR email = $2 OR username = $3)
       ORDER BY auth_user_id = $1 DESC
       LIMIT 1`,
      [session.user.id, session.user.email, session.user.username ?? null],
    );

    const user = result.rows[0];
    if (user) {
      if (!user.auth_user_id) {
        await query("UPDATE users SET auth_user_id = $1 WHERE id = $2", [
          session.user.id,
          user.id,
        ]);
        user.auth_user_id = session.user.id;
      }
      return user;
    }
  }

  const rawUserId = request.headers.get("x-user-id");
  const userId = Number(rawUserId);
  if (!Number.isInteger(userId)) return null;

  const result = await query<UserRow>(
    "SELECT id, auth_user_id, nama, email, username, role FROM users WHERE id = $1 AND deleted_at IS NULL",
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function requireUser(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return {
      user: null,
      error: { message: "Login diperlukan.", status: 401 },
    };
  }
  return { user, error: null };
}

export async function requireManager(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) return auth;
  if (auth.user.role !== "manajer" && auth.user.role !== "administrator") {
    return {
      user: auth.user,
      error: { message: "Akses hanya untuk Manajer.", status: 403 },
    };
  }
  return auth;
}

export async function requireAdministrator(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) return auth;
  if (auth.user.role !== "administrator") {
    return {
      user: auth.user,
      error: { message: "Akses hanya untuk Administrator.", status: 403 },
    };
  }
  return auth;
}

export async function requirePermission(
  request: NextRequest,
  section: string,
  action: "can_view" | "can_create" | "can_update" | "can_delete",
) {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) return auth;
  if (auth.user.role === "administrator") return auth;

  const cacheKey = `${auth.user.role}:${section}:${action}`;
  const cached = permissionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    if (cached.allowed) return auth;
  }

  const permission = await query<{ allowed: boolean }>(
    `SELECT ${action} allowed
     FROM role_permissions
     WHERE role = $1
       AND section = $2
     LIMIT 1`,
    [auth.user.role, section],
  );
  const allowed = permission.rows[0]?.allowed === true;
  permissionCache.set(cacheKey, {
    allowed,
    expiresAt: Date.now() + permissionCacheTtlMs,
  });
  if (allowed) return auth;

  return {
    user: auth.user,
    error: { message: "Akses menu tidak diizinkan.", status: 403 },
  };
}
