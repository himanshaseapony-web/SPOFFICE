// Simple script to set a user as admin in Firestore
// Run with: node set-admin-firestore.js

import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables from .env.local if it exists
const envPath = join(__dirname, 'apps/web/.env.local')
let firebaseConfig = {}

if (existsSync(envPath)) {
  const envFile = readFileSync(envPath, 'utf-8')
  envFile.split('\n').forEach((line) => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim()
      if (key.startsWith('VITE_FIREBASE_')) {
        firebaseConfig[key] = value
      }
    }
  })
} else {
  // Try using env.example values if .env.local doesn't exist
  console.log('⚠️  .env.local not found, checking env.example...')
  const envExamplePath = join(__dirname, 'apps/web/env.example')
  if (existsSync(envExamplePath)) {
    const envFile = readFileSync(envExamplePath, 'utf-8')
    envFile.split('\n').forEach((line) => {
      const match = line.match(/^([^=]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        const value = match[2].trim()
        if (key.startsWith('VITE_FIREBASE_') && value && !value.includes('your-')) {
          firebaseConfig[key] = value
        }
      }
    })
  }
}

const adminUid = 'fv3jGpZT0JhfjTWg55Yg5ihtud63'

async function setAdmin() {
  try {
    const config = {
      apiKey: firebaseConfig.VITE_FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
      authDomain: firebaseConfig.VITE_FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: firebaseConfig.VITE_FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: firebaseConfig.VITE_FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: firebaseConfig.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: firebaseConfig.VITE_FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID,
    }

    // Validate config
    if (!config.apiKey || !config.projectId) {
      throw new Error('Missing Firebase configuration. Make sure .env.local exists in apps/web/ with Firebase config')
    }

    console.log('🔥 Initializing Firebase...')
    const app = initializeApp(config)
    const db = getFirestore(app)

    console.log(`📝 Setting user ${adminUid} as Admin...`)
    
    // Check if user profile exists
    const userProfileRef = doc(db, 'userProfiles', adminUid)
    const userProfileSnap = await getDoc(userProfileRef)

    if (userProfileSnap.exists()) {
      // Update existing profile
      const existingData = userProfileSnap.data()
      await setDoc(userProfileRef, {
        ...existingData,
        role: 'Admin',
        department: 'all',
        updatedAt: new Date().toISOString(),
      }, { merge: true })
      console.log(`✅ Successfully updated user ${adminUid} to Admin role`)
      console.log(`   Display Name: ${existingData.displayName || 'Not set'}`)
      console.log(`   Email: ${existingData.email || 'Not set'}`)
      console.log(`   Department: all`)
      console.log(`   Role: Admin`)
    } else {
      // Create new profile
      await setDoc(userProfileRef, {
        id: adminUid,
        role: 'Admin',
        displayName: 'Admin User',
        email: 'admin@openwork.com',
        department: 'all',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      console.log(`✅ Successfully created admin profile for user ${adminUid}`)
      console.log(`   Display Name: Admin User`)
      console.log(`   Email: admin@openwork.com`)
      console.log(`   Department: all`)
      console.log(`   Role: Admin`)
    }

    process.exit(0)
  } catch (error) {
    console.error('❌ Error setting admin:', error.message)
    if (error.stack) {
      console.error('Stack:', error.stack)
    }
    process.exit(1)
  }
}

setAdmin()
