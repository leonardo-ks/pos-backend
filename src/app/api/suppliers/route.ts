import { createResource, listResource, resources } from "@/lib/feature-crud";

export const GET = listResource(resources.suppliers);
export const POST = createResource(resources.suppliers);
