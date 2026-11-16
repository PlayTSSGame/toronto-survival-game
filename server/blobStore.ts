import { getStore } from '@netlify/blobs'
import type { Bucket, BucketStore } from './stats.ts'

/** Netlify Blobs storage for the play-statistics counters (conditional writes, so concurrent players don't lose counts). */
export function blobStore(): BucketStore {
  const store = getStore('tss-stats')
  return {
    async read(key) {
      const r = await store.getWithMetadata(key, { type: 'json' })
      return r ? { data: r.data as Bucket, etag: r.etag } : { data: null }
    },
    async write(key, data, etag) {
      const res = await store.setJSON(key, data, etag ? { onlyIfMatch: etag } : { onlyIfNew: true })
      return res.modified
    },
  }
}
