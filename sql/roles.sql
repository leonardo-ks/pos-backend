CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  kode TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  keterangan TEXT,
  system_role BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

INSERT INTO roles (kode, nama, keterangan, system_role)
VALUES
  ('kasir', 'Kasir', 'Akses kasir operasional.', TRUE),
  ('manajer', 'Manajer', 'Akses manajemen toko.', TRUE),
  ('administrator', 'Administrator', 'Akses penuh sistem.', TRUE)
ON CONFLICT (kode) DO UPDATE
SET nama = EXCLUDED.nama,
    keterangan = EXCLUDED.keterangan,
    system_role = TRUE,
    deleted_at = NULL,
    updated_at = NOW();

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE role_permissions
  DROP CONSTRAINT IF EXISTS role_permissions_role_check;

INSERT INTO role_permissions (role, section, can_view, can_create, can_update, can_delete)
VALUES
  ('kasir', 'roles', FALSE, FALSE, FALSE, FALSE),
  ('manajer', 'roles', FALSE, FALSE, FALSE, FALSE),
  ('administrator', 'roles', TRUE, TRUE, TRUE, TRUE)
ON CONFLICT (role, section) DO UPDATE
SET can_view = EXCLUDED.can_view,
    can_create = EXCLUDED.can_create,
    can_update = EXCLUDED.can_update,
    can_delete = EXCLUDED.can_delete,
    updated_at = NOW();
