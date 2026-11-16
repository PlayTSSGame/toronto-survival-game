// Netlify function: POST /api/track (anonymous play statistics)
import { blobStore } from '../../server/blobStore.ts'
import { handleTrack } from '../../server/stats.ts'

export default (req: Request): Promise<Response> => handleTrack(req, blobStore())
export const config = { path: '/api/track' }
