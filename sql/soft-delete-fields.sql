ALTER TABLE products
  ADD COLUMN IF NOT EXISTS keterangan TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE product_categories
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE customer_group_discounts
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE discount_categories
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

INSERT INTO role_permissions
  (role, section, can_view, can_create, can_update, can_delete)
VALUES
  ('kasir', 'master', TRUE, FALSE, FALSE, FALSE),
  ('manajer', 'master', TRUE, TRUE, TRUE, FALSE),
  ('administrator', 'master', TRUE, TRUE, TRUE, TRUE)
ON CONFLICT (role, section) DO UPDATE
SET can_view = EXCLUDED.can_view,
    can_create = EXCLUDED.can_create,
    can_update = EXCLUDED.can_update,
    can_delete = EXCLUDED.can_delete,
    updated_at = NOW();
