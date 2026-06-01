import { Pool } from "pg";

const baseUrl = process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000";
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgres://postgres:postgres@localhost:5432/pos_kasir",
});

const users = [
  {
    name: "Dewi Kasir",
    email: "kasir@pos.local",
    username: "kasir",
    password: "password1234",
    role: "kasir",
  },
  {
    name: "Bima Manajer",
    email: "manajer@pos.local",
    username: "manajer",
    password: "password1234",
    role: "manajer",
  },
  {
    name: "Ari Administrator",
    email: "admin@pos.local",
    username: "admin",
    password: "password1234",
    role: "administrator",
  },
];

for (const user of users) {
  const existing = await pool.query('SELECT id FROM "user" WHERE email = $1', [
    user.email,
  ]);

  let authUserId = existing.rows[0]?.id;

  if (!authUserId) {
    const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: baseUrl,
      },
      body: JSON.stringify({
        name: user.name,
        email: user.email,
        username: user.username,
        displayUsername: user.username,
        password: user.password,
        role: user.role,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(
        `Failed to seed ${user.email}: ${JSON.stringify(payload)}`,
      );
    }

    authUserId = payload.user.id;
  }

  await pool.query(
    `UPDATE "user"
     SET role = $2,
         name = $3,
         username = $4,
         "displayUsername" = $4,
         "updatedAt" = NOW()
     WHERE id = $1`,
    [authUserId, user.role, user.name, user.username],
  );

  await pool.query(
    `INSERT INTO users (nama, email, username, role, auth_user_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE
     SET nama = EXCLUDED.nama,
         username = EXCLUDED.username,
         role = EXCLUDED.role,
         auth_user_id = EXCLUDED.auth_user_id`,
    [user.name, user.email, user.username, user.role, authUserId],
  );
}

await pool.end();
console.log("Seeded Better Auth demo users.");
