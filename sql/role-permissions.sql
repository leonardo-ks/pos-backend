CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('kasir', 'manajer', 'administrator')),
  section TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT TRUE,
  can_create BOOLEAN NOT NULL DEFAULT FALSE,
  can_update BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role, section)
);

INSERT INTO role_permissions
  (role, section, can_view, can_create, can_update, can_delete)
VALUES
  ('kasir', 'pos', TRUE, TRUE, FALSE, FALSE),
  ('kasir', 'inventory', TRUE, FALSE, FALSE, FALSE),
  ('kasir', 'customers', FALSE, FALSE, FALSE, FALSE),
  ('kasir', 'suppliers', FALSE, FALSE, FALSE, FALSE),
  ('kasir', 'purchases', FALSE, FALSE, FALSE, FALSE),
  ('kasir', 'purchase-returns', FALSE, FALSE, FALSE, FALSE),
  ('kasir', 'sales-returns', FALSE, FALSE, FALSE, FALSE),
  ('kasir', 'reports', FALSE, FALSE, FALSE, FALSE),
  ('kasir', 'users', FALSE, FALSE, FALSE, FALSE),
  ('kasir', 'authorization', FALSE, FALSE, FALSE, FALSE),

  ('manajer', 'pos', TRUE, TRUE, FALSE, FALSE),
  ('manajer', 'inventory', TRUE, TRUE, TRUE, FALSE),
  ('manajer', 'customers', TRUE, TRUE, TRUE, FALSE),
  ('manajer', 'suppliers', TRUE, TRUE, TRUE, FALSE),
  ('manajer', 'purchases', TRUE, TRUE, TRUE, FALSE),
  ('manajer', 'purchase-returns', TRUE, TRUE, TRUE, FALSE),
  ('manajer', 'sales-returns', TRUE, TRUE, TRUE, FALSE),
  ('manajer', 'reports', TRUE, FALSE, FALSE, FALSE),
  ('manajer', 'users', FALSE, FALSE, FALSE, FALSE),
  ('manajer', 'authorization', FALSE, FALSE, FALSE, FALSE),

  ('administrator', 'pos', TRUE, TRUE, TRUE, TRUE),
  ('administrator', 'inventory', TRUE, TRUE, TRUE, TRUE),
  ('administrator', 'customers', TRUE, TRUE, TRUE, TRUE),
  ('administrator', 'suppliers', TRUE, TRUE, TRUE, TRUE),
  ('administrator', 'purchases', TRUE, TRUE, TRUE, TRUE),
  ('administrator', 'purchase-returns', TRUE, TRUE, TRUE, TRUE),
  ('administrator', 'sales-returns', TRUE, TRUE, TRUE, TRUE),
  ('administrator', 'reports', TRUE, TRUE, TRUE, TRUE),
  ('administrator', 'users', TRUE, TRUE, TRUE, TRUE),
  ('administrator', 'authorization', TRUE, TRUE, TRUE, TRUE)
ON CONFLICT (role, section) DO NOTHING;

SELECT setval('role_permissions_id_seq', GREATEST((SELECT MAX(id) FROM role_permissions), 1), true);
