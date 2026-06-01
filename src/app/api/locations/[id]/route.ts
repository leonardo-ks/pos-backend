import { deleteResource, resources, updateResource } from "@/lib/feature-crud";

export const PATCH = updateResource(resources.locations);
export const DELETE = deleteResource(resources.locations);
