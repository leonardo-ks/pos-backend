export function discountRate(category: string | null | undefined) {
  switch (category?.toLowerCase()) {
    case "vip":
      return 0.1;
    case "gold":
      return 0.15;
    default:
      return 0;
  }
}
