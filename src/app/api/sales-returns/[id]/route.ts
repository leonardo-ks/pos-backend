import {
  transactionConfigs,
  getBusinessTransaction,
  updateBusinessTransaction,
} from "@/lib/feature-transactions";

export const GET = getBusinessTransaction(transactionConfigs.salesReturns);
export const PATCH = updateBusinessTransaction(transactionConfigs.salesReturns);

