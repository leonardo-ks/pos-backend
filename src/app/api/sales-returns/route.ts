import {
  createBusinessTransaction,
  listBusinessTransactions,
  transactionConfigs,
} from "@/lib/feature-transactions";

export const GET = listBusinessTransactions(transactionConfigs.salesReturns);
export const POST = createBusinessTransaction(transactionConfigs.salesReturns);
