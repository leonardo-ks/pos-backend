import {
  createPayment,
  listPayments,
  payablePaymentConfig,
} from "@/lib/payments";

export const GET = listPayments(payablePaymentConfig);
export const POST = createPayment(payablePaymentConfig);
