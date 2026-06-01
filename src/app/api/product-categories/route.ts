import { createResource, listResource, resources } from "@/lib/feature-crud";

export const GET = listResource(resources.productCategories);
export const POST = createResource(resources.productCategories);
