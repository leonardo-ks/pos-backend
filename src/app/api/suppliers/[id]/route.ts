import { deleteResource, resources, updateResource } from "@/lib/feature-crud";

export const PATCH = updateResource(resources.suppliers);
export const DELETE = deleteResource(resources.suppliers);
