import { getFunctions, httpsCallable } from 'firebase/functions'
import { getFirebaseApp } from './firebase'

const functions = getFunctions(getFirebaseApp())

export const resetUserPassword = httpsCallable<{ userId: string; newPassword: string }, { success: boolean; message: string }>(
  functions,
  'resetUserPassword'
)

export const deleteUser = httpsCallable<{ userId: string }, { success: boolean; message: string }>(
  functions,
  'deleteUser'
)

