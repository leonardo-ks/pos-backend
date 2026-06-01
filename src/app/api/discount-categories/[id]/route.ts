import { deleteResource, resources, updateResource } from "@/lib/feature-crud";

export const PATCH = updateResource(resources.discountCategories);
export const DELETE = deleteResource(resources.discountCategories);
