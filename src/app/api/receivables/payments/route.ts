import {
  createPayment,
  listPayments,
  receivablePaymentConfig,
} from "@/lib/payments";

export const GET = listPayments(receivablePaymentConfig);
export const POST = createPayment(receivablePaymentConfig);
