import { deleteResource, resources, updateResource } from "@/lib/feature-crud";

export const PATCH = updateResource(resources.productCategories);
export const DELETE = deleteResource(resources.productCategories);
