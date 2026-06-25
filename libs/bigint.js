const DECIMALS = 8n
const SCALE = 10n ** DECIMALS

export function dollarsToBigInt(dollars) {
  if (typeof dollars === 'bigint') return dollars
  const str = String(dollars).trim()
  const negative = str.startsWith('-')
  const clean = negative ? str.slice(1) : str
  const [whole = '0', frac = ''] = clean.split('.')
  const padded = frac.padEnd(Number(DECIMALS), '0').slice(0, Number(DECIMALS))
  const value = BigInt(whole || '0') * SCALE + BigInt(padded || '0')
  return negative ? -value : value
}

export function bigIntToDisplay(amount) {
  const negative = amount < 0n
  const abs = negative ? -amount : amount
  const whole = abs / SCALE
  const frac = (abs % SCALE).toString().padStart(Number(DECIMALS), '0').replace(/0+$/, '') || '0'
  return `${negative ? '-' : ''}${whole}.${frac}`
}

export function bigIntToPayPal(amount) {
  const negative = amount < 0n
  const abs = negative ? -amount : amount
  const whole = abs / SCALE
  const frac = (abs % SCALE).toString().padStart(2, '0').slice(0, 2)
  return `${negative ? '-' : ''}${whole}.${frac}`
}

export function addAmounts(...amounts) {
  return amounts.reduce((sum, a) => sum + (typeof a === 'bigint' ? a : dollarsToBigInt(a)), 0n)
}
