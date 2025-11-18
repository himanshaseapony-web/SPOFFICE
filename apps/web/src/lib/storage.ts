import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { getFirebaseApp } from './firebase'

export async function uploadProfileImage(userId: string, file: File): Promise<string> {
  const app = getFirebaseApp()
  const storage = getStorage(app)
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    throw new Error('File must be an image')
  }
  
  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image must be less than 5MB')
  }
  
  // Create a reference to the file location
  const imageRef = ref(storage, `profile-images/${userId}/${Date.now()}_${file.name}`)
  
  // Upload the file
  await uploadBytes(imageRef, file)
  
  // Get the download URL
  const downloadURL = await getDownloadURL(imageRef)
  
  return downloadURL
}

export async function deleteProfileImage(imageUrl: string): Promise<void> {
  try {
    const app = getFirebaseApp()
    const storage = getStorage(app)
    
    // Extract the path from the URL
    const url = new URL(imageUrl)
    const path = decodeURIComponent(url.pathname.split('/o/')[1]?.split('?')[0] || '')
    
    if (path) {
      const imageRef = ref(storage, path)
      await deleteObject(imageRef)
    }
  } catch (error) {
    console.error('Failed to delete profile image', error)
    // Don't throw - deletion is not critical
  }
}

