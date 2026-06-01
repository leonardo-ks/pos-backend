import {
  createBusinessTransaction,
  listBusinessTransactions,
  transactionConfigs,
} from "@/lib/feature-transactions";

export const GET = listBusinessTransactions(transactionConfigs.purchases);
export const POST = createBusinessTransaction(transactionConfigs.purchases);
