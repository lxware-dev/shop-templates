const priceFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
});

function formatPrice(price: number): string {
  return priceFormatter.format(price);
}

export { formatPrice };
