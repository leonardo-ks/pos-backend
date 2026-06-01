import { createResource, listResource, resources } from "@/lib/feature-crud";

export const GET = listResource(resources.discountCategories);
export const POST = createResource(resources.discountCategories);
