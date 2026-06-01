import { createResource, listResource, resources } from "@/lib/feature-crud";

export const GET = listResource(resources.locations);
export const POST = createResource(resources.locations);
