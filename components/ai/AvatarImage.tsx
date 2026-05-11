'use client'

import type { ReactNode } from 'react'
import { appendCacheBuster } from '@/lib/avatar'

interface AvatarImageProps {
  src?: string
  alt: string
  fallback: ReactNode
  cacheKey?: string | number
  className?: string
}

export function AvatarImage({ src, alt, fallback, cacheKey, className }: AvatarImageProps) {
  if (!src) {
    return <>{fallback}</>
  }

  return <img src={appendCacheBuster(src, cacheKey)} alt={alt} className={className} />
}
