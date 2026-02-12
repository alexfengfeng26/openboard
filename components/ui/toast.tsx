'use client'

import { toast as sonnerToast } from 'sonner'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export function toast(message: string, type: ToastType = 'info') {
  switch (type) {
    case 'success':
      sonnerToast.success(message)
      break
    case 'error':
      sonnerToast.error(message)
      break
    case 'warning':
      sonnerToast.warning(message)
      break
    default:
      sonnerToast(message)
  }
}

export function toastSuccess(message: string) {
  sonnerToast.success(message)
}

export function toastError(message: string) {
  sonnerToast.error(message)
}

export function toastWarning(message: string) {
  sonnerToast.warning(message)
}

export function toastInfo(message: string) {
  sonnerToast.info(message)
}

export { Toaster } from 'sonner'
