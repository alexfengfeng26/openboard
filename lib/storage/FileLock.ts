/**
 * 文件锁实现 - 用于并发控制
 */

import { promises as fs } from 'fs'
import path from 'path'
import { LockAcquisitionError } from '@/types/storage.types'

/**
 * 锁释放函数类型
 */
export type LockReleaseFunction = () => Promise<void>

/**
 * 锁选项
 */
export interface LockOptions {
  maxRetries?: number
  retryDelay?: number
  timeout?: number
}

/**
 * 文件锁类
 * 使用文件系统锁实现并发控制
 */
export class FileLock {
  private static readonly LOCK_DIR = path.join(process.cwd(), 'data', '.lock')
  private readonly lockPath: string
  private acquired: boolean = false

  private constructor(lockPath: string) {
    this.lockPath = lockPath
  }

  /**
   * 获取锁
   * @param lockPath 锁文件路径
   * @param options 锁选项
   * @returns 释放函数，如果获取失败则抛出错误
   */
  static async acquire(lockPath: string, options: LockOptions = {}): Promise<LockReleaseFunction> {
    const {
      maxRetries = 10,
      retryDelay = 50,
      timeout = 5000,
    } = options

    // 确保锁目录存在
    await fs.mkdir(FileLock.LOCK_DIR, { recursive: true })

    const lockFile = FileLock.getLockFilePath(lockPath)

    for (let i = 0; i < maxRetries; i++) {
      try {
        // 尝试创建锁文件（独占模式）
        const lockHandle = await fs.open(lockFile, 'wx')

        // 写入当前进程 ID
        await lockHandle.writeFile(process.pid.toString(), 'utf-8')
        await lockHandle.close()

        // 获取成功
        const lock: FileLock = new FileLock(lockPath)
        lock.acquired = true

        // 设置超时自动释放
        const timeoutId = lock.startTimeout(timeout)

        return async () => {
          clearTimeout(timeoutId)
          await lock.release()
        }
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code

        if (code === 'EEXIST') {
          // 锁已被占用，等待后重试
          if (i < maxRetries - 1) {
            await FileLock.delay(retryDelay * Math.pow(1.5, i))
          }
          continue
        }

        throw new LockAcquisitionError(
          `无法获取锁文件: ${lockFile}，在 ${maxRetries} 次重试后失败`
        )
      }
    }

    throw new LockAcquisitionError(`锁获取超时: ${lockFile}`)
  }

  /**
   * 尝试获取锁（单次，不重试）
   * @returns 释放函数，如果锁已被占用则返回 null
   */
  static async tryAcquire(lockPath: string): Promise<LockReleaseFunction | null> {
    await fs.mkdir(FileLock.LOCK_DIR, { recursive: true })

    const lockFile = FileLock.getLockFilePath(lockPath)

    try {
      const lockHandle = await fs.open(lockFile, 'wx')
      await lockHandle.writeFile(process.pid.toString(), 'utf-8')
      await lockHandle.close()

      const lock: FileLock = new FileLock(lockPath)
      lock.acquired = true

      return async () => {
        await lock.release()
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'EEXIST') {
        return null
      }
      throw err
    }
  }

  /**
   * 检查锁是否被占用
   */
  static async isLocked(lockPath: string): Promise<boolean> {
    const lockFile = FileLock.getLockFilePath(lockPath)
    try {
      await fs.access(lockFile)
      return true
    } catch {
      return false
    }
  }

  /**
   * 释放锁
   */
  async release(): Promise<void> {
    if (!this.acquired) {
      return
    }

    try {
      const lockFilePath = FileLock.getLockFilePath(this.lockPath)
      await fs.unlink(lockFilePath)
    } catch {
      // 锁文件可能已被清理，忽略错误
    } finally {
      this.acquired = false
    }
  }

  /**
   * 启动超时自动释放
   */
  private startTimeout(timeout: number): NodeJS.Timeout {
    return setTimeout(async () => {
      if (this.acquired) {
        await this.release()
      }
    }, timeout)
  }

  /**
   * 获取锁文件路径
   */
  private static getLockFilePath(lockPath: string): string {
    return path.join(FileLock.LOCK_DIR, `${path.basename(lockPath)}.lock`)
  }

  /**
   * 延迟函数
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 清理过期的锁文件（应在应用启动时调用）
   */
  static async cleanupStaleLocks(): Promise<void> {
    try {
      await fs.mkdir(FileLock.LOCK_DIR, { recursive: true })

      const files = await fs.readdir(FileLock.LOCK_DIR)
      const now = Date.now()

      for (const file of files) {
        const filePath = path.join(FileLock.LOCK_DIR, file)
        const stats = await fs.stat(filePath)

        // 如果锁文件超过 30 秒，认为是过期的
        if (now - stats.mtimeMs > 30000) {
          try {
            // 检查进程是否存在
            const content = await fs.readFile(filePath, 'utf-8')
            const pid = parseInt(content, 10)

            try {
              // 检查进程是否还在运行
              process.kill(pid, 0)
            } catch {
              // 进程不存在，可以安全删除锁文件
              await fs.unlink(filePath)
            }
          } catch {
            // 忽略清理错误
          }
        }
      }
    } catch {
      // 目录不存在或其他错误，忽略
    }
  }
}
