import {
  transactionConfigs,
  getBusinessTransaction,
  updateBusinessTransaction,
} from "@/lib/feature-transactions";

export const GET = getBusinessTransaction(transactionConfigs.purchaseReturns);
export const PATCH = updateBusinessTransaction(
  transactionConfigs.purchaseReturns,
);

