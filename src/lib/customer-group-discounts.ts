import { asInteger, asNumber, asOptionalString } from "@/lib/validation";

export function parseCustomerGroupDiscountBody(body: Record<string, unknown>) {
  return {
    customerId: asInteger(body.customer_id, "customer_id", 1),
    categoryId: asInteger(body.category_id, "category_id", 1),
    rate: asNumber(body.rate ?? 0, "rate", 0),
    keterangan: asOptionalString(body.keterangan) ?? "",
  };
}
