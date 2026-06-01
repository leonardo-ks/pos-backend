import { asString, ValidationError } from "@/lib/validation";

const sections = [
  "pos",
  "master",
  "inventory",
  "customers",
  "suppliers",
  "purchases",
  "purchase-returns",
  "sales-returns",
  "reports",
  "users",
  "roles",
  "authorization",
];

export function parsePermissionBody(body: Record<string, unknown>) {
  const role = asString(body.role, "role");
  const section = asString(body.section, "section");
  if (!sections.includes(section)) {
    throw new ValidationError("Menu tidak valid.");
  }
  return {
    role,
    section,
    can_view: asBoolean(body.can_view),
    can_create: asBoolean(body.can_create),
    can_update: asBoolean(body.can_update),
    can_delete: asBoolean(body.can_delete),
  };
}

function asBoolean(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}
