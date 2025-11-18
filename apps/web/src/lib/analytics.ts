import type { Analytics } from 'firebase/analytics'
import { getAnalytics, isSupported } from 'firebase/analytics'
import { getFirebaseApp } from './firebase'

let analyticsInstance: Analytics | null | undefined

export async function initAnalytics() {
  if (analyticsInstance !== undefined) {
    return analyticsInstance
  }

  if (typeof window === 'undefined') {
    analyticsInstance = null
    return analyticsInstance
  }

  try {
    const supported = await isSupported()
    if (!supported) {
      analyticsInstance = null
      return analyticsInstance
    }

    analyticsInstance = getAnalytics(getFirebaseApp())
  } catch (error) {
    console.warn('Firebase Analytics could not be initialized', error)
    analyticsInstance = null
  }

  return analyticsInstance
}

