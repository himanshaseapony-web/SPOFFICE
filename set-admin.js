import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { config } from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
config({ path: join(__dirname, 'apps/web/.env.local') })

const adminUid = 'fv3jGpZT0JhfjTWg55Yg5ihtud63'

async function setAdmin() {
  try {
    // Initialize Firebase Admin if not already initialized
    if (getApps().length === 0) {
      // For Firebase Admin, we need service account credentials
      // Since we don't have them, let's use the Firebase SDK with a script instead
      console.log('Firebase Admin SDK requires service account. Using alternative method...')
      process.exit(1)
    }

    const db = getFirestore()
    const userProfileRef = db.collection('userProfiles').doc(adminUid)

    await userProfileRef.set({
      role: 'Admin',
      displayName: 'Admin User',
      email: 'admin@openwork.com',
      department: 'all',
      updatedAt: new Date().toISOString(),
    }, { merge: true })

    console.log(`✅ Successfully set user ${adminUid} as Admin`)
    process.exit(0)
  } catch (error) {
    console.error('Error setting admin:', error)
    process.exit(1)
  }
}

setAdmin()

