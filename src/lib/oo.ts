/** Format a price in USD. */
export const oo = (amount: number) => `$${amount % 1 === 0 ? amount : amount.toFixed(2)}`
