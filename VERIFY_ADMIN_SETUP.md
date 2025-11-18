# Verify Admin Setup

## Issue: User showing as Viewer instead of Admin

### Steps to Fix:

1. **Verify the Firestore Document Exists:**
   - Go to: https://console.firebase.google.com/project/openwork-bef57/firestore/databases/-default-/data
   - Navigate to: `userProfiles` collection
   - Find document with ID: `fv3jGpZT0JhfjTWg55Yg5ihtud63`
   - **CRITICAL:** Check that the `role` field is exactly `"Admin"` (capital A, lowercase admin)
   - Check that the `department` field is `"all"`

2. **Correct Document Structure:**
   ```json
   {
     "id": "fv3jGpZT0JhfjTWg55Yg5ihtud63",
     "role": "Admin",
     "department": "all",
     "displayName": "Admin User",
     "email": "your-email@example.com",
     "updatedAt": "2024-01-01T00:00:00.000Z"
   }
   ```

3. **Common Issues:**
   - ❌ `role: "admin"` (lowercase) - **WRONG**
   - ❌ `role: "ADMIN"` (all caps) - **WRONG**
   - ✅ `role: "Admin"` (capital A) - **CORRECT**
   
4. **After Setting the Role:**
   - Log out of the app completely
   - Log back in
   - Check the browser console (F12 → Console) for debug messages:
     - Look for: `📋 User profile loaded:` - should show `role: "Admin"`
     - Look for: `🔍 Topbar - User role:` - should show `"Admin"`

5. **Verify in App:**
   - Topbar should show "Admin" next to your name
   - Sidebar should show Admin-only pages:
     - Departments
     - Reports
     - Automation
     - Settings
   - "Create Task" button should be enabled

6. **If Still Not Working:**
   - Open browser DevTools (F12)
   - Go to Console tab
   - Look for error messages
   - Check Network tab for Firestore requests
   - Verify the document ID matches your Firebase Auth UID exactly

## Quick Fix Command (if you have Firebase Admin access):

Use Firebase Console to update the document, or create it if it doesn't exist.

