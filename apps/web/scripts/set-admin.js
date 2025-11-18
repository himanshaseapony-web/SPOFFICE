// Script to set a user as admin in Firestore
// Run with: cd apps/web && node scripts/set-admin.js

import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore'

// Load config from env.example or use the values directly
const firebaseConfig = {
  apiKey: 'AIzaSyBG8lXuYRusq5W_bxPPhzNCcwdjAqtgHC4',
  authDomain: 'openwork-bef57.firebaseapp.com',
  projectId: 'openwork-bef57',
  storageBucket: 'openwork-bef57.firebasestorage.app',
  messagingSenderId: '145310652328',
  appId: '1:145310652328:web:cc39f212abc1287411ef9d',
  measurementId: 'G-HTSR5M4LK2',
  databaseURL: 'https://openwork-bef57-default-rtdb.firebaseio.com',
}

const adminUid = 'fv3jGpZT0JhfjTWg55Yg5ihtud63'

async function setAdmin() {
  try {
    console.log('🔥 Initializing Firebase...')
    const app = initializeApp(firebaseConfig)
    const db = getFirestore(app)

    console.log(`📝 Setting user ${adminUid} as Admin...`)

    // Note: This requires authentication or service account
    // For production, use Firebase Console or Admin SDK
    // This script will work if you're authenticated in Firebase CLI
    
    const userProfileRef = doc(db, 'userProfiles', adminUid)
    const userProfileSnap = await getDoc(userProfileRef)

    if (userProfileSnap.exists()) {
      const existingData = userProfileSnap.data()
      await setDoc(
        userProfileRef,
        {
          ...existingData,
          role: 'Admin',
          department: 'all',
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      )
      console.log(`✅ Successfully updated user ${adminUid} to Admin role`)
      console.log(`   Display Name: ${existingData.displayName || 'Not set'}`)
      console.log(`   Email: ${existingData.email || 'Not set'}`)
      console.log(`   Department: all`)
      console.log(`   Role: Admin`)
    } else {
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
    console.error('')
    console.error('This script requires Firebase authentication.')
    console.error('Please use one of these methods:')
    console.error('')
    console.error('1. Firebase Console (Recommended):')
    console.error(
      '   https://console.firebase.google.com/project/openwork-bef57/firestore',
    )
    console.error(`   Navigate to: userProfiles/${adminUid}`)
    console.error('   Set role: "Admin", department: "all"')
    console.error('')
    console.error('2. Or authenticate in Firebase CLI and try again:')
    console.error('   firebase login')
    console.error('')
    if (error.stack) {
      console.error('Stack:', error.stack)
    }
    process.exit(1)
  }
}

setAdmin()

