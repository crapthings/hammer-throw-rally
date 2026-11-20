export const CHARGE_STAGES = [
  { start: 0, end: 100, seconds: 1.15, name: 'charge' },
  { start: 100, end: 120, seconds: 0.45, name: 'overload' },
  { start: 120, end: 150, seconds: 0.70, name: 'goldenCharge' },
  { start: 150, end: 200, seconds: 1.10, name: 'thunderCharge' },
]

export const MAX_CHARGE = CHARGE_STAGES.at(-1).end

export function chargePower(time) {
  for (const { start, end, seconds } of CHARGE_STAGES) {
    if (Math.abs(time - seconds) < 1e-9) return end / 100
    if (time < seconds) return (start + (end - start) * time / seconds) / 100
    time -= seconds
  }
  return MAX_CHARGE / 100
}
