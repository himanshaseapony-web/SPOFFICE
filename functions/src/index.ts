import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

admin.initializeApp()

/**
 * Verifies that the calling user is an admin
 */
async function verifyAdmin(uid: string): Promise<boolean> {
  try {
    const userProfileDoc = await admin.firestore().collection('userProfiles').doc(uid).get()
    if (!userProfileDoc.exists) {
      return false
    }
    const userProfile = userProfileDoc.data()
    return userProfile?.role === 'Admin'
  } catch (error) {
    console.error('Error verifying admin:', error)
    return false
  }
}

/**
 * Reset a user's password (admin only)
 * Admin must provide the new password
 */
export const resetUserPassword = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
  }

  // Verify admin role
  const isAdmin = await verifyAdmin(context.auth.uid)
  if (!isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Only administrators can reset user passwords')
  }

  // Validate input
  const { userId, newPassword } = data
  if (!userId || typeof userId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'userId is required and must be a string')
  }
  
  if (!newPassword || typeof newPassword !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'newPassword is required and must be a string')
  }
  
  // Validate password length (Firebase requires at least 6 characters)
  if (newPassword.length < 6) {
    throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 6 characters long')
  }

  try {
    // Prevent admins from resetting their own password
    if (userId === context.auth.uid) {
      throw new functions.https.HttpsError('invalid-argument', 'Admins cannot reset their own password')
    }

    // Update user's password
    await admin.auth().updateUser(userId, {
      password: newPassword,
    })

    return {
      success: true,
      message: 'Password reset successfully',
    }
  } catch (error: any) {
    console.error('Error resetting password:', error)
    if (error.code === 'auth/user-not-found') {
      throw new functions.https.HttpsError('not-found', 'User not found')
    }
    throw new functions.https.HttpsError('internal', 'Failed to reset password', error.message)
  }
})

/**
 * Delete a user from Firebase Auth and Firestore (admin only)
 * Also deletes all related data: tasks, chat messages, etc.
 */
export const deleteUser = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
  }

  // Verify admin role
  const isAdmin = await verifyAdmin(context.auth.uid)
  if (!isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Only administrators can delete users')
  }

  // Validate input
  const { userId } = data
  if (!userId || typeof userId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'userId is required and must be a string')
  }

  try {
    // Prevent admins from deleting themselves
    if (userId === context.auth.uid) {
      throw new functions.https.HttpsError('invalid-argument', 'Admins cannot delete themselves')
    }

    const db = admin.firestore()
    const batch = db.batch()

    // Delete all tasks assigned to this user
    const tasksSnapshot = await db.collection('tasks').where('assigneeId', '==', userId).get()
    tasksSnapshot.forEach((doc) => {
      batch.delete(doc.ref)
    })

    // Delete all department chat messages by this user
    const deptChatsSnapshot = await db.collection('departmentChats').where('authorId', '==', userId).get()
    deptChatsSnapshot.forEach((doc) => {
      batch.delete(doc.ref)
    })

    // Delete all company chat messages by this user
    const companyChatsSnapshot = await db.collection('companyChats').where('authorId', '==', userId).get()
    companyChatsSnapshot.forEach((doc) => {
      batch.delete(doc.ref)
    })

    // Delete user profile
    const userProfileRef = db.collection('userProfiles').doc(userId)
    batch.delete(userProfileRef)

    // Commit all Firestore deletions
    await batch.commit()

    // Delete user from Firebase Auth
    await admin.auth().deleteUser(userId)

    return {
      success: true,
      message: 'User and all associated data deleted successfully',
    }
  } catch (error: any) {
    console.error('Error deleting user:', error)
    if (error.code === 'auth/user-not-found') {
      throw new functions.https.HttpsError('not-found', 'User not found')
    }
    throw new functions.https.HttpsError('internal', 'Failed to delete user', error.message)
  }
})

