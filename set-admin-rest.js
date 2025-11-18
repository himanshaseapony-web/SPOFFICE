// Script to set a user as admin using Firestore REST API
// This requires the user to be authenticated, so we'll create a simple approach

const adminUid = 'fv3jGpZT0JhfjTWg55Yg5ihtud63'
const projectId = 'openwork-bef57'

console.log('📝 To set user as Admin, please use one of these methods:')
console.log('')
console.log('Method 1: Use Firebase Console (Recommended)')
console.log('1. Go to: https://console.firebase.google.com/project/openwork-bef57/firestore')
console.log('2. Navigate to the "userProfiles" collection')
console.log(`3. Create or update document with ID: ${adminUid}`)
console.log('4. Set these fields:')
console.log('   - role: "Admin"')
console.log('   - department: "all"')
console.log('   - displayName: (user\'s name)')
console.log('   - email: (user\'s email)')
console.log('')
console.log('Method 2: Use the app directly')
console.log('1. Run the app: cd apps/web && npm run dev')
console.log('2. Log in as the user')
console.log('3. The app will create their profile automatically')
console.log('4. Then manually update in Firebase Console or use the script below')
console.log('')
console.log(`Document path: userProfiles/${adminUid}`)
console.log('Data to set:')
console.log(JSON.stringify({
  id: adminUid,
  role: 'Admin',
  department: 'all',
  displayName: 'Admin User',
  email: 'admin@openwork.com',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}, null, 2))

