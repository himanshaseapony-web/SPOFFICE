# Setup Admin User for Task Creation

## Your User ID
`Zx8kRTrfEphyzrdWMniG2gxIMjn2`

## Steps to Set Up Admin:

### 1. Verify/Create User Profile in Firestore

1. Go to Firebase Console: https://console.firebase.google.com/project/openwork-bef57/firestore/databases/-default-/data

2. Navigate to `userProfiles` collection

3. **If document exists** with ID `Zx8kRTrfEphyzrdWMniG2gxIMjn2`:
   - Click on it to edit
   - Ensure these fields exist and are correct:
     - `role`: **`"Admin"`** (exactly - capital A, lowercase admin)
     - `department`: **`"all"`**
     - `displayName`: Your display name
     - `email`: Your email
     - `id`: `Zx8kRTrfEphyzrdWMniG2gxIMjn2`

4. **If document does NOT exist**:
   - Click "Add document"
   - Document ID: `Zx8kRTrfEphyzrdWMniG2gxIMjn2`
   - Add these fields:
     ```
     role: Admin (String)
     department: all (String)
     displayName: Your Name (String)
     email: your-email@example.com (String)
     id: Zx8kRTrfEphyzrdWMniG2gxIMjn2 (String)
     createdAt: 2024-01-01T00:00:00Z (Timestamp or String)
     updatedAt: 2024-01-01T00:00:00Z (Timestamp or String)
     ```

### 2. Verify Role is Correct

**CRITICAL:** The `role` field must be exactly:
- ✅ `"Admin"` - CORRECT (capital A, lowercase admin)
- ❌ `"admin"` - WRONG
- ❌ `"ADMIN"` - WRONG
- ❌ `"Administrator"` - WRONG

### 3. After Setting Up:

1. **Log out** of the app completely
2. **Log back in** with the same account
3. Check the browser console (F12 → Console) for:
   - `📋 User profile loaded:` should show `role: "Admin"`
   - `🔍 Topbar - User role:` should show `"Admin"`

### 4. Try Creating a Task:

1. Click "Create Task" button (should be enabled for Admin)
2. Fill in all fields:
   - **Title**: Required
   - **Department**: Required - select from dropdown
   - **Assignee**: Required - select from dropdown
   - **Summary**: Required - enter text
   - **Due Date**: Optional
3. Click "Create Task"
4. Check for errors:
   - If error appears, it will be shown in a red box in the modal
   - Check browser console (F12) for detailed error messages
   - Error will show your current role if permission denied

### 5. Troubleshooting:

**If task creation still fails:**

1. Check browser console (F12 → Console):
   - Look for `❌ Failed to create task:`
   - Check the error code and message

2. Verify user profile exists:
   - Open browser console
   - Type: `localStorage` (to verify you're logged in)

3. Common issues:
   - Profile doesn't exist → Create it in Firestore
   - Role is wrong → Set to exactly `"Admin"`
   - Department is wrong → Set to `"all"`
   - Profile not loaded → Log out and log back in

### Debug Commands:

Open browser console (F12) and check:
```javascript
// Check current user
// The app should log: 📋 User profile loaded: {role: "Admin", ...}
```

The error message will now show:
- Your current role if permission denied
- The exact error code
- Where to check in Firebase Console

