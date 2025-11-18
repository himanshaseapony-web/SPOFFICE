import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL?.trim(),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID?.trim(),
}

let app: FirebaseApp | undefined

export function getFirebaseApp() {
  if (!app) {
    const requiredKeys: Array<keyof FirebaseOptions> = [
      'apiKey',
      'authDomain',
      'projectId',
      'storageBucket',
      'messagingSenderId',
      'appId',
    ]

    for (const key of requiredKeys) {
      const value = firebaseConfig[key]
      if (!value) {
        const message = `Missing Firebase configuration value for "${key}". Check your .env.local file.`
        console.error(message)
        throw new Error(message)
      }
    }
    app = initializeApp(firebaseConfig)
  }
  return app
}

