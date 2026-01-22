import { collection, doc, getDoc, setDoc, updateDoc, deleteDoc, Timestamp, query, where, getDocs, writeBatch, type Firestore } from 'firebase/firestore'

export type KPIPoint = {
  userId: string
  userName: string
  department: string
  points: number
  tasksAssigned: number
  tasksCompletedOnTime: number
  tasksCompletedLate: number
  tasksIncomplete: number
  effectivePoints: number  // Actual points after penalties
  score: number           // Percentage score
  lastUpdated: string
}

export type KPIPointHistory = {
  id: string
  userId: string
  userName: string
  points: number
  reason: string
  updateId: string
  department: string
  month: string
  year: number
  taskDetails: string
  awardedAt: string
  deadline?: string
  completedAt?: string
  wasLate?: boolean
}

/**
 * Normalizes department names to standard format
 * Maps variations like "3D Design", "3D", "UI", "UX" to standard names
 * Case-insensitive matching
 */
export function normalizeDepartment(department: string): string {
  const normalized = department.trim().toLowerCase()
  
  // Map 3D Development variations (check these first, more specific)
  if (
    normalized === '3d design' || 
    normalized === '3d development' || 
    normalized === '3d dev' || 
    normalized === '3d' ||
    normalized === '3-d' ||
    normalized === 'three d' ||
    normalized === 'threed'
  ) {
    return '3D Development'
  }
  
  // Map UI/UX variations
  if (
    normalized === 'ui/ux' ||
    normalized === 'ui / ux' ||
    normalized === 'ui ux' ||
    normalized === 'uiux' ||
    normalized === 'ui_ux' ||
    normalized === 'ui' ||
    normalized === 'ux' ||
    normalized === 'user interface' ||
    normalized === 'user experience' ||
    normalized === 'design'
  ) {
    return 'UI/UX'
  }
  
  // Map Programming variations
  if (
    normalized === 'programming' ||
    normalized === 'programmer' ||
    normalized === 'dev' ||
    normalized === 'developer' ||
    normalized === 'development' ||
    normalized === 'software' ||
    normalized === 'code' ||
    normalized === 'coding'
  ) {
    return 'Programming'
  }
  
  // If no match found, return original (trimmed)
  console.warn(`⚠️ Unknown department: "${department}" - please update to use standard names`)
  return department.trim()
}

/**
 * Sanitizes department name for use in Firestore document IDs
 * Replaces characters that are not allowed in Firestore document IDs
 * (forward slashes are not allowed in Firestore document IDs)
 */
function sanitizeDepartmentForDocId(department: string): string {
  // Replace forward slashes with underscores for Firestore document IDs
  return department.replace(/\//g, '_')
}

/**
 * Awards KPI points to all assignees in a department when their work is completed
 * @param firestore Firestore instance
 * @param updateId Calendar update ID
 * @param department Department name
 * @param assignees Array of assignees in the department
 * @param month Month of the update
 * @param year Year of the update
 * @param taskDetails Task details for history tracking
 * @param deadline Optional deadline for the task (ISO string)
 */
export async function awardKPIPoints(
  firestore: Firestore,
  updateId: string,
  department: string,
  assignees: Array<{ id: string; name: string }>,
  month: string,
  year: number,
  taskDetails: string,
  deadline?: string
): Promise<void> {
  if (!firestore || assignees.length === 0) {
    return
  }

  // Normalize department name to standard format (e.g., "3D Design" → "3D Development")
  const normalizedDepartment = normalizeDepartment(department)
  if (normalizedDepartment !== department) {
    console.log(`📝 Normalizing department: "${department}" → "${normalizedDepartment}"`)
  }

  const now = Timestamp.now()
  const nowISO = new Date().toISOString()
  const completedAt = new Date()

  // Check if completed after deadline
  const wasLate = deadline ? completedAt > new Date(deadline) : false
  const pointsToAward = wasLate ? 0.5 : 1.0 // Half points for late completion
  
  const statusEmoji = wasLate ? '⚠️' : '✅'
  const statusText = wasLate ? 'Late' : 'On-time'

  console.log(`${statusEmoji} Awarding ${pointsToAward} point(s) (${statusText}) to ${assignees.length} assignee(s) in ${normalizedDepartment}`)
  if (deadline) {
    console.log(`   Deadline: ${new Date(deadline).toLocaleString()}, Completed: ${completedAt.toLocaleString()}`)
  }

  // Award points to each assignee
  const pointAwards = assignees.map(async (assignee) => {
    // Use composite key: userId_department to allow users to have scores in multiple departments
    // Sanitize department name for Firestore document ID (replace "/" with "_")
    const sanitizedDept = sanitizeDepartmentForDocId(normalizedDepartment)
    const docId = `${assignee.id}_${sanitizedDept}`
    const kpiRef = doc(firestore, 'kpiPoints', docId)
    const historyRef = doc(collection(firestore, 'kpiPointHistory'))
    
    console.log(`   Creating/updating KPI record: ${docId} (${normalizedDepartment})`)

    // Track if history record was created (for cleanup on error)
    let historyCreated = false

    try {
      // CRITICAL: Check if points were already awarded for this updateId+department+userId combination
      // This prevents duplicate awards if the status is changed multiple times or called concurrently
      // We use a transaction-like approach: check history BEFORE awarding points
      const historyQuery = query(
        collection(firestore, 'kpiPointHistory'),
        where('updateId', '==', updateId),
        where('department', '==', normalizedDepartment),
        where('userId', '==', assignee.id)
      )
      const existingHistory = await getDocs(historyQuery)
      
      if (!existingHistory.empty) {
        console.log(`⚠️ KPI points already awarded to ${assignee.name} for ${normalizedDepartment} in update ${updateId}. Found ${existingHistory.size} existing record(s). Skipping duplicate.`)
        return // Skip this assignee - points already awarded
      }

      // Create history record FIRST to act as a "lock" preventing duplicate awards
      // This ensures that if multiple calls happen simultaneously, only one will succeed
      // We create the history record with a unique ID, so even if two calls happen at once,
      // the second one will see the history record when it checks
      // Note: If point awarding fails later, we'll clean up the history record
      try {
        await setDoc(historyRef, {
          userId: assignee.id,
          userName: assignee.name,
          points: pointsToAward,
          reason: wasLate ? 'Calendar Update Completed Late' : 'Calendar Update Completed On-Time',
          updateId,
          department: normalizedDepartment,
          month,
          year,
          taskDetails,
          awardedAt: now,
          deadline: deadline || null,
          completedAt: nowISO,
          wasLate: wasLate,
        })
        historyCreated = true

        // CRITICAL: Re-check history AFTER creating the record to ensure we're the only one
        // Firestore has eventual consistency, so we need to re-check after a brief moment
        // This prevents race conditions where multiple calls all pass the initial check
        // Use a small exponential backoff to handle Firestore's eventual consistency
        let retries = 3
        let doubleCheckHistory = await getDocs(historyQuery)
        while (retries > 0 && doubleCheckHistory.size === 0) {
          // History record might not be immediately visible due to eventual consistency
          await new Promise(resolve => setTimeout(resolve, 50))
          doubleCheckHistory = await getDocs(historyQuery)
          retries--
        }
        
        // Now check if we have duplicates or if another process created the record
        if (doubleCheckHistory.size > 1) {
          // Multiple history records were created - this shouldn't happen, but if it does, delete the extra ones
          console.warn(`⚠️ Multiple history records found for ${assignee.name} in update ${updateId}. This indicates a race condition. Cleaning up duplicates.`)
          // Keep the first one (oldest), delete the rest
          const sortedDocs = doubleCheckHistory.docs.sort((a, b) => {
            const aTime = a.data().awardedAt?.toMillis?.() || 0
            const bTime = b.data().awardedAt?.toMillis?.() || 0
            return aTime - bTime
          })
          const docsToDelete = sortedDocs.slice(1)
          for (const docToDelete of docsToDelete) {
            await deleteDoc(docToDelete.ref)
            console.log(`   🧹 Deleted duplicate history record: ${docToDelete.id}`)
          }
          // Only proceed if this is the first (oldest) record
          if (sortedDocs[0].id !== historyRef.id) {
            console.log(`⚠️ Another process already created the history record first. Skipping point award to prevent duplicate.`)
            return
          }
        } else if (doubleCheckHistory.size === 1 && doubleCheckHistory.docs[0].id !== historyRef.id) {
          // Another process created a history record between our check and creation
          console.log(`⚠️ Another process created the history record. Skipping point award to prevent duplicate.`)
          return
        }
      } catch (historyError: any) {
        // If history creation fails, check if it's because another process already created it
        const checkHistory = await getDocs(historyQuery)
        if (!checkHistory.empty) {
          console.log(`⚠️ History record already exists (created by another process). Skipping point award.`)
          return
        }
        // If it's a different error, re-throw it
        throw historyError
      }

      // Check if user already has KPI points record
      // IMPORTANT: Re-read the KPI record to get the latest values (handles concurrent updates)
      const kpiSnapshot = await getDoc(kpiRef)
      
      if (kpiSnapshot.exists()) {
        const currentData = kpiSnapshot.data()
        const currentPoints = currentData.points || 0
        const currentEffective = currentData.effectivePoints || 0
        const currentAssigned = currentData.tasksAssigned || 0
        const currentOnTime = currentData.tasksCompletedOnTime || 0
        const currentLate = currentData.tasksCompletedLate || 0

        // CRITICAL: Verify that we haven't already awarded points for this task
        // Double-check history one more time right before updating to prevent race conditions
        const finalHistoryCheck = await getDocs(historyQuery)
        const ourHistoryRecord = finalHistoryCheck.docs.find(doc => doc.id === historyRef.id)
        if (!ourHistoryRecord) {
          // Our history record doesn't exist - another process must have deleted it or we're in a race condition
          console.warn(`⚠️ History record not found for ${assignee.name} in update ${updateId}. Another process may have already processed this. Skipping.`)
          return
        }
        
        // Check if there are multiple history records (shouldn't happen, but handle it)
        if (finalHistoryCheck.size > 1) {
          console.warn(`⚠️ Multiple history records detected for ${assignee.name} in update ${updateId}. This should have been cleaned up earlier.`)
          // Only proceed if our record is the first one
          const sortedDocs = finalHistoryCheck.docs.sort((a, b) => {
            const aTime = a.data().awardedAt?.toMillis?.() || 0
            const bTime = b.data().awardedAt?.toMillis?.() || 0
            return aTime - bTime
          })
          if (sortedDocs[0].id !== historyRef.id) {
            console.log(`⚠️ Not the first history record. Skipping point award.`)
            return
          }
        }

        // Calculate new values
        const newAssigned = currentAssigned + 1
        const newOnTime = wasLate ? currentOnTime : currentOnTime + 1
        const newLate = wasLate ? currentLate + 1 : currentLate
        const newEffective = currentEffective + pointsToAward
        const newScore = (newEffective / newAssigned) * 100

        // CRITICAL: Verify data integrity before updating
        // Count how many history records exist for this user+department (across all updates)
        // This should match tasksAssigned (one history record per task)
        const allHistoryQuery = query(
          collection(firestore, 'kpiPointHistory'),
          where('userId', '==', assignee.id),
          where('department', '==', normalizedDepartment)
        )
        const allHistoryRecords = await getDocs(allHistoryQuery)
        const totalHistoryCount = allHistoryRecords.size
        
        // If tasksAssigned doesn't match history count, there's a data inconsistency
        // This could happen if points were awarded multiple times for the same task
        if (currentAssigned !== totalHistoryCount && currentAssigned > 0) {
          console.warn(`⚠️ Data inconsistency detected for ${assignee.name} in ${normalizedDepartment}: tasksAssigned (${currentAssigned}) ≠ history records (${totalHistoryCount}). This may indicate duplicate awards or data corruption.`)
          // Use the history count as the source of truth (it's more reliable)
          // But for now, we'll still increment to maintain backward compatibility
          // In the future, we could fix the data by setting tasksAssigned = totalHistoryCount
        }

        // Update existing record
        await updateDoc(kpiRef, {
          points: currentPoints + pointsToAward,
          tasksAssigned: newAssigned,
          tasksCompletedOnTime: newOnTime,
          tasksCompletedLate: newLate,
          effectivePoints: newEffective,
          score: newScore,
          lastUpdated: nowISO,
        })

        console.log(`   ✅ ${assignee.name}: ${currentEffective.toFixed(1)} → ${newEffective.toFixed(1)} points, tasks: ${currentAssigned} → ${newAssigned} (${newScore.toFixed(0)}% score)`)
      } else {
        // Create new record
        const newScore = (pointsToAward / 1) * 100
        await setDoc(kpiRef, {
          userId: assignee.id,
          userName: assignee.name,
          department: normalizedDepartment,
          points: pointsToAward,
          tasksAssigned: 1,
          tasksCompletedOnTime: wasLate ? 0 : 1,
          tasksCompletedLate: wasLate ? 1 : 0,
          tasksIncomplete: 0,
          effectivePoints: pointsToAward,
          score: newScore,
          lastUpdated: nowISO,
          createdAt: nowISO,
        })

        console.log(`   ${assignee.name}: New KPI record created with ${pointsToAward.toFixed(1)} points (${newScore.toFixed(0)}% score)`)
      }

      // History record was already created above as a "lock" to prevent duplicates
      // No need to create it again here
    } catch (error: any) {
      console.error(`❌ Failed to award KPI points to ${assignee.name}:`, error)
      console.error('Error details:', {
        code: error?.code,
        message: error?.message,
        updateId,
        department: normalizedDepartment,
        assigneeId: assignee.id,
      })
      
      // If we created a history record but failed to award points, clean up the history record
      // This prevents inconsistent state where history exists but points weren't awarded
      if (historyCreated) {
        try {
          await deleteDoc(historyRef)
          console.log(`🧹 Cleaned up history record for ${assignee.name} after point award failure`)
        } catch (cleanupError) {
          console.error(`❌ Failed to clean up history record for ${assignee.name}:`, cleanupError)
        }
      }
      
      // Don't throw - continue with other assignees
    }
  })

  await Promise.all(pointAwards)
}

/**
 * Removes KPI points when a calendar update is deleted
 * This reverses all point awards associated with the update
 * @param firestore Firestore instance
 * @param updateId Calendar update ID
 */
export async function removeKPIPoints(
  firestore: Firestore,
  updateId: string
): Promise<void> {
  if (!firestore || !updateId) {
    return
  }

  try {
    console.log(`🔄 Removing KPI points for deleted update: ${updateId}`)
    
    // Find all history records for this update
    const historyQuery = query(
      collection(firestore, 'kpiPointHistory'),
      where('updateId', '==', updateId)
    )
    const historySnapshot = await getDocs(historyQuery)

    if (historySnapshot.empty) {
      console.log(`ℹ️ No KPI points found for update ${updateId}`)
      return
    }

    console.log(`📋 Found ${historySnapshot.size} point award(s) to reverse`)

    // Group history records by user+department (composite key) to batch updates
    const userDeptPointsMap = new Map<string, { userId: string; userName: string; department: string; totalPoints: number; records: any[] }>()
    
    historySnapshot.docs.forEach(historyDoc => {
      const data = historyDoc.data()
      // Sanitize department for document ID (replace "/" with "_")
      const sanitizedDept = sanitizeDepartmentForDocId(data.department)
      const compositeKey = `${data.userId}_${sanitizedDept}`
      
      if (!userDeptPointsMap.has(compositeKey)) {
        userDeptPointsMap.set(compositeKey, {
          userId: data.userId,
          userName: data.userName,
          department: data.department,
          totalPoints: 0,
          records: []
        })
      }
      
      const userDeptInfo = userDeptPointsMap.get(compositeKey)!
      userDeptInfo.totalPoints += data.points
      userDeptInfo.records.push({ id: historyDoc.id, ...data })
    })

    // Reverse points for each user+department combination
    const reversals = Array.from(userDeptPointsMap.values()).map(async (userDeptInfo) => {
      // Sanitize department for document ID (replace "/" with "_")
      const sanitizedDept = sanitizeDepartmentForDocId(userDeptInfo.department)
      const compositeKey = `${userDeptInfo.userId}_${sanitizedDept}`
      const kpiRef = doc(firestore, 'kpiPoints', compositeKey)
      
      try {
        // Check if user still has KPI points record
        const kpiSnapshot = await getDoc(kpiRef)
        
        if (kpiSnapshot.exists()) {
          const currentPoints = kpiSnapshot.data().points || 0
          const newPoints = Math.max(0, currentPoints - userDeptInfo.totalPoints) // Don't go negative
          
          // Update user's total points
          await updateDoc(kpiRef, {
            points: newPoints,
            lastUpdated: new Date().toISOString(),
          })
          
          console.log(`✅ Removed ${userDeptInfo.totalPoints} point(s) from ${userDeptInfo.userName} in ${userDeptInfo.department} (${currentPoints} → ${newPoints})`)
        } else {
          console.log(`⚠️ KPI record not found for user ${userDeptInfo.userName} in ${userDeptInfo.department}, skipping point removal`)
        }

        // Create reversal history records for audit trail
        const now = Timestamp.now()
        const nowISO = new Date().toISOString()
        
        for (const record of userDeptInfo.records) {
          const reversalRef = doc(collection(firestore, 'kpiPointHistory'))
          await setDoc(reversalRef, {
            userId: record.userId,
            userName: record.userName,
            points: -record.points, // Negative points to indicate reversal
            reason: 'Calendar Update Deleted',
            updateId: record.updateId,
            department: record.department,
            month: record.month,
            year: record.year,
            taskDetails: record.taskDetails,
            awardedAt: now,
            originalAwardId: record.id, // Reference to original award
            reversedAt: nowISO,
          })
        }
        
        console.log(`📝 Created ${userDeptInfo.records.length} reversal record(s) for ${userDeptInfo.userName} in ${userDeptInfo.department}`)
      } catch (error: any) {
        console.error(`❌ Failed to remove KPI points from ${userDeptInfo.userName} in ${userDeptInfo.department}:`, error)
        console.error('Error details:', {
          code: error?.code,
          message: error?.message,
          userId: userDeptInfo.userId,
          department: userDeptInfo.department,
          updateId,
        })
        // Don't throw - continue with other users
      }
    })

    await Promise.all(reversals)
    console.log(`✅ Successfully removed all KPI points for update ${updateId}`)
  } catch (error: any) {
    console.error(`❌ Failed to remove KPI points for update ${updateId}:`, error)
    console.error('Error details:', {
      code: error?.code,
      message: error?.message,
      updateId,
    })
    // Don't throw - this is a cleanup operation
  }
}

/**
 * Resets all KPI points to zero (Admin only)
 * Creates audit trail records for the reset
 * @param firestore Firestore instance
 * @param adminUserId Admin user ID performing the reset
 * @param adminUserName Admin user display name
 */
export async function resetAllKPIPoints(
  firestore: Firestore,
  adminUserId: string,
  adminUserName: string
): Promise<{ success: boolean; usersReset: number; error?: string }> {
  if (!firestore || !adminUserId || !adminUserName) {
    return { success: false, usersReset: 0, error: 'Missing required parameters' }
  }

  try {
    console.log(`🔄 Resetting all KPI points by ${adminUserName} (${adminUserId})`)
    
    // Get all KPI points documents
    const kpiPointsRef = collection(firestore, 'kpiPoints')
    const kpiPointsSnapshot = await getDocs(kpiPointsRef)

    if (kpiPointsSnapshot.empty) {
      console.log('ℹ️ No KPI points to reset')
      return { success: true, usersReset: 0 }
    }

    console.log(`📋 Found ${kpiPointsSnapshot.size} user(s) with KPI points`)

    const now = Timestamp.now()
    const nowISO = new Date().toISOString()
    const batch = writeBatch(firestore)
    let batchCount = 0
    const maxBatchSize = 500 // Firestore batch limit

    // Collect user info and prepare reset operations
    const usersToReset: Array<{ userId: string; userName: string; currentPoints: number }> = []
    
    kpiPointsSnapshot.docs.forEach((docSnapshot) => {
      const data = docSnapshot.data()
      usersToReset.push({
        userId: docSnapshot.id,
        userName: data.userName || 'Unknown',
        currentPoints: data.points || 0,
      })
    })

    // Reset all KPI points to 0 using batch writes
    for (const userInfo of usersToReset) {
      if (batchCount >= maxBatchSize) {
        // Commit current batch and start a new one
        await batch.commit()
        console.log(`✅ Committed batch of ${batchCount} operations`)
        batchCount = 0
      }

      const kpiRef = doc(firestore, 'kpiPoints', userInfo.userId)
      
      // Reset all KPI fields to 0
      batch.update(kpiRef, {
        points: 0,
        tasksAssigned: 0,
        tasksCompletedOnTime: 0,
        tasksCompletedLate: 0,
        tasksIncomplete: 0,
        effectivePoints: 0,
        score: 0,
        lastUpdated: nowISO,
        resetAt: nowISO,
        resetBy: adminUserId,
        resetByName: adminUserName,
      })
      batchCount++

      // Create reset history record (separate from batch to avoid size limits)
      const historyRef = doc(collection(firestore, 'kpiPointHistory'))
      batch.set(historyRef, {
        userId: userInfo.userId,
        userName: userInfo.userName,
        points: -userInfo.currentPoints, // Negative to show points removed
        reason: 'Admin Reset - All KPI Points',
        updateId: 'system_reset',
        department: 'All',
        month: new Date().toLocaleString('en-US', { month: 'long' }),
        year: new Date().getFullYear(),
        taskDetails: `System-wide KPI reset by ${adminUserName}`,
        awardedAt: now,
        resetBy: adminUserId,
        resetByName: adminUserName,
        resetAt: nowISO,
        previousPoints: userInfo.currentPoints, // Store original value
      })
      batchCount++

      console.log(`📝 Reset ${userInfo.userName}: ${userInfo.currentPoints} → 0`)
    }

    // Commit final batch
    if (batchCount > 0) {
      await batch.commit()
      console.log(`✅ Committed final batch of ${batchCount} operations`)
    }

    console.log(`✅ Successfully reset KPI points for ${usersToReset.length} user(s)`)
    
    return { 
      success: true, 
      usersReset: usersToReset.length 
    }
  } catch (error: any) {
    console.error('❌ Failed to reset KPI points:', error)
    console.error('Error details:', {
      code: error?.code,
      message: error?.message,
      adminUserId,
    })
    
    return { 
      success: false, 
      usersReset: 0, 
      error: error?.message || 'Unknown error occurred' 
    }
  }
}
