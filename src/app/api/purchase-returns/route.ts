import {
  createBusinessTransaction,
  listBusinessTransactions,
  transactionConfigs,
} from "@/lib/feature-transactions";

export const GET = listBusinessTransactions(transactionConfigs.purchaseReturns);
export const POST = createBusinessTransaction(
  transactionConfigs.purchaseReturns,
);
