# Firebase Cloud Functions

This directory contains Firebase Cloud Functions for the SPOFFICE application.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build the functions:
```bash
npm run build
```

## Functions

### `resetUserPassword`
Allows admins to reset a user's password and receive the new password.
- **Authentication**: Required (Admin only)
- **Parameters**: `userId` (string)
- **Returns**: `{ success: boolean, newPassword: string, message: string }`

### `deleteUser`
Allows admins to delete a user account and profile.
- **Authentication**: Required (Admin only)
- **Parameters**: `userId` (string)
- **Returns**: `{ success: boolean, message: string }`

## Deployment

Deploy all functions:
```bash
npm run deploy
```

Or deploy via Firebase CLI from project root:
```bash
firebase deploy --only functions
```

## Local Development

Start the emulator:
```bash
npm run serve
```

