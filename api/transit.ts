// Vercel function: GET /api/transit
import { handleTransit } from '../server/transit.ts'

export function GET(): Promise<Response> {
  return handleTransit()
}
