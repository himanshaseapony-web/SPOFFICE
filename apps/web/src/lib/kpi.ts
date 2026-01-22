import { collection, doc, getDoc, setDoc, updateDoc, increment, Timestamp, query, where, getDocs, writeBatch, type Firestore } from 'firebase/firestore'

export type KPIPoint = {
  userId: string
  userName: string
  points: number
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
 */
export async function awardKPIPoints(
  firestore: Firestore,
  updateId: string,
  department: string,
  assignees: Array<{ id: string; name: string }>,
  month: string,
  year: number,
  taskDetails: string
): Promise<void> {
  if (!firestore || assignees.length === 0) {
    return
  }

  const pointsPerCompletion = 1
  const now = Timestamp.now()
  const nowISO = new Date().toISOString()

  // Award points to each assignee
  const pointAwards = assignees.map(async (assignee) => {
    const kpiRef = doc(firestore, 'kpiPoints', assignee.id)
    const historyRef = doc(collection(firestore, 'kpiPointHistory'))

    try {
      // Check if points were already awarded for this updateId+department+userId combination
      // This prevents duplicate awards if the status is changed multiple times
      const historyQuery = query(
        collection(firestore, 'kpiPointHistory'),
        where('updateId', '==', updateId),
        where('department', '==', department),
        where('userId', '==', assignee.id)
      )
      const existingHistory = await getDocs(historyQuery)
      
      if (!existingHistory.empty) {
        console.log(`⚠️ KPI points already awarded to ${assignee.name} for ${department} in update ${updateId}. Skipping duplicate.`)
        return // Skip this assignee - points already awarded
      }

      // Check if user already has KPI points record
      const kpiSnapshot = await getDoc(kpiRef)
      
      if (kpiSnapshot.exists()) {
        // Update existing record
        await updateDoc(kpiRef, {
          points: increment(pointsPerCompletion),
          lastUpdated: nowISO,
        })
      } else {
        // Create new record
        await setDoc(kpiRef, {
          userId: assignee.id,
          userName: assignee.name,
          points: pointsPerCompletion,
          lastUpdated: nowISO,
          createdAt: nowISO,
        })
      }

      // Create history record
      await setDoc(historyRef, {
        userId: assignee.id,
        userName: assignee.name,
        points: pointsPerCompletion,
        reason: 'Calendar Update Completed',
        updateId,
        department,
        month,
        year,
        taskDetails,
        awardedAt: now,
      })

      console.log(`✅ Awarded ${pointsPerCompletion} KPI point(s) to ${assignee.name} for completing ${department} work in ${month} ${year}`)
    } catch (error: any) {
      console.error(`❌ Failed to award KPI points to ${assignee.name}:`, error)
      console.error('Error details:', {
        code: error?.code,
        message: error?.message,
        updateId,
        department,
        assigneeId: assignee.id,
      })
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

    // Group history records by user to batch updates
    const userPointsMap = new Map<string, { userId: string; userName: string; totalPoints: number; records: any[] }>()
    
    historySnapshot.docs.forEach(historyDoc => {
      const data = historyDoc.data()
      const userId = data.userId
      
      if (!userPointsMap.has(userId)) {
        userPointsMap.set(userId, {
          userId: data.userId,
          userName: data.userName,
          totalPoints: 0,
          records: []
        })
      }
      
      const userInfo = userPointsMap.get(userId)!
      userInfo.totalPoints += data.points
      userInfo.records.push({ id: historyDoc.id, ...data })
    })

    // Reverse points for each user
    const reversals = Array.from(userPointsMap.values()).map(async (userInfo) => {
      const kpiRef = doc(firestore, 'kpiPoints', userInfo.userId)
      
      try {
        // Check if user still has KPI points record
        const kpiSnapshot = await getDoc(kpiRef)
        
        if (kpiSnapshot.exists()) {
          const currentPoints = kpiSnapshot.data().points || 0
          const newPoints = Math.max(0, currentPoints - userInfo.totalPoints) // Don't go negative
          
          // Update user's total points
          await updateDoc(kpiRef, {
            points: newPoints,
            lastUpdated: new Date().toISOString(),
          })
          
          console.log(`✅ Removed ${userInfo.totalPoints} point(s) from ${userInfo.userName} (${currentPoints} → ${newPoints})`)
        } else {
          console.log(`⚠️ KPI record not found for user ${userInfo.userName}, skipping point removal`)
        }

        // Create reversal history records for audit trail
        const now = Timestamp.now()
        const nowISO = new Date().toISOString()
        
        for (const record of userInfo.records) {
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
        
        console.log(`📝 Created ${userInfo.records.length} reversal record(s) for ${userInfo.userName}`)
      } catch (error: any) {
        console.error(`❌ Failed to remove KPI points from ${userInfo.userName}:`, error)
        console.error('Error details:', {
          code: error?.code,
          message: error?.message,
          userId: userInfo.userId,
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
      
      // Reset points to 0
      batch.update(kpiRef, {
        points: 0,
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
