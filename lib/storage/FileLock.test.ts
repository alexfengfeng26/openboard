import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'
import { FileLock } from './FileLock'

const LOCK_DIR = path.join(process.cwd(), 'data', '.lock')
const TEST_LOCK_PATH = path.join(process.cwd(), 'data', 'test-file.lock')

async function cleanupTestLocks() {
  try {
    const files = await fs.readdir(LOCK_DIR)
    for (const file of files) {
      if (file.startsWith('test-') && file.endsWith('.lock')) {
        await fs.unlink(path.join(LOCK_DIR, file))
      }
    }
  } catch {
    // ignore
  }
}

describe('FileLock', () => {
  beforeEach(async () => {
    await cleanupTestLocks()
  })

  afterEach(async () => {
    await cleanupTestLocks()
  })

  it('acquire returns a release function', async () => {
    const release = await FileLock.acquire(TEST_LOCK_PATH)
    expect(typeof release).toBe('function')
    await release()
  })

  it('same file lock is exclusive', async () => {
    const release1 = await FileLock.acquire(TEST_LOCK_PATH, { timeout: 5000 })

    // tryAcquire should fail immediately when lock is held
    const release2 = await FileLock.tryAcquire(TEST_LOCK_PATH)
    expect(release2).toBeNull()

    await release1()
  })

  it('release allows subsequent acquire', async () => {
    const release1 = await FileLock.acquire(TEST_LOCK_PATH)
    await release1()

    const release2 = await FileLock.acquire(TEST_LOCK_PATH)
    expect(typeof release2).toBe('function')
    await release2()
  })

  it('cleanupStaleLocks removes expired locks', async () => {
    const staleLockPath = path.join(process.cwd(), 'data', 'test-stale-file')
    const staleLockFile = path.join(LOCK_DIR, 'test-stale-file.lock')

    await fs.mkdir(LOCK_DIR, { recursive: true })
    await fs.writeFile(staleLockFile, '99999', 'utf-8')

    // Set mtime to 60 seconds ago (exceeds 30s threshold)
    const oldTime = new Date(Date.now() - 60000)
    await fs.utimes(staleLockFile, oldTime, oldTime)

    expect(await FileLock.isLocked(staleLockPath)).toBe(true)

    await FileLock.cleanupStaleLocks()

    expect(await FileLock.isLocked(staleLockPath)).toBe(false)
  })
})
