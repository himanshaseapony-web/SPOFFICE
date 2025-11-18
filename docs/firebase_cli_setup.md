## Firebase CLI Setup

Follow these steps to connect the repository to your Firebase project using the Firebase CLI:

1. **Authenticate**
   ```bash
   npx firebase login
   ```
   This opens a browser window where you can sign in with the account that owns your Firebase project.

2. **Select Your Project**
   ```bash
   npx firebase use --add
   ```
   From the prompt, choose the Firebase project you want to connect. When asked for an alias, enter `default` so it matches the `.firebaserc` configuration.

3. **Verify Configuration**
   Confirm that `.firebaserc` now contains your project ID:
   ```json
   {
     "projects": {
       "default": "your-project-id"
     }
   }
   ```

4. **Deploy (Optional)**
   Build the frontend and deploy to Firebase Hosting:
   ```bash
   cd apps/web
   npm run build
   npx firebase deploy --only hosting
   ```

5. **Create Environment Variables**
   In `apps/web`, create a `.env.local` with your Firebase config:
   ```
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id # optional, needed for analytics
   VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com # optional
   ```
   These values are available in the Firebase console under *Project Settings → General → SDK setup*.

6. **Local Emulation (Optional)**
   If you later add Firestore, Functions, or Hosting emulators, run:
   ```bash
   npx firebase emulators:start
   ```

### Notes
- The CLI is installed locally as a dev dependency (`firebase-tools`). All commands above use `npx` so no global install is required.
- Update `firebase.json` if you change build output paths or add new Firebase services.

