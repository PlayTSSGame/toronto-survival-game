import type { Environment } from '../types'

/** TTC: 0–15 min delay has no impact; beyond that 1 + minutes/60. */
export function ttcModifier(delayMinutes: number): number {
  return delayMinutes > 15 ? 1 + delayMinutes / 60 : 1
}

/**
 * Weather: below 0°C -> 1 + |temp|/20; precipitation > 5 mm -> 1.25.
 * If both apply the larger wins (client spec is silent on stacking).
 */
export function weatherModifier(tempC: number, precipMm: number): number {
  const cold = tempC < 0 ? 1 + Math.abs(tempC) / 20 : 1
  const rain = precipMm > 5 ? 1.25 : 1
  return Math.max(cold, rain)
}

/** Neutral readings used until live adapters (Milestone 2) are wired in. */
export const FALLBACK_ENV: Environment = {
  delayMinutes: 0,
  tempC: 10,
  precipMm: 0,
  weatherLabel: 'Weather: offline',
  transitLabel: 'TTC: offline',
  weatherSource: 'fallback',
  transitSource: 'fallback',
}
