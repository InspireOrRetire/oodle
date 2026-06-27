/** Format an Oodle wallet amount with the branded $? currency symbol. */
export const oo = (amount: number) => `$?${amount.toFixed(2)}`
