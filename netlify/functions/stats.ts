// Netlify function: /stats, password-protected live player and ?ref= referral counts
import { blobStore } from '../../server/blobStore.ts'
import { handleStats } from '../../server/stats.ts'

export default (req: Request): Promise<Response> => handleStats(req, blobStore(), process.env.STATS_PASSWORD)
export const config = { path: '/stats' }
