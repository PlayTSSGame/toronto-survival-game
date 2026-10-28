// Netlify function: GET /api/transit
import { handleTransit } from '../../server/transit.ts'

export default (): Promise<Response> => handleTransit()
export const config = { path: '/api/transit' }
