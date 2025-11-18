# Security Guidelines

## Firebase API Key Restrictions

**IMPORTANT**: The Firebase API key is exposed in client-side code. While Firebase API keys are designed to be public, they must be properly restricted in the Firebase Console to prevent abuse.

### Steps to Restrict Firebase API Key:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Project Settings** → **General** tab
4. Scroll down to **Your apps** section
5. Find your Web app and click on it
6. Go to **API restrictions** section
7. Click **Restrict key**
8. Add the following restrictions:
   - **Application restrictions**: HTTP referrers (web sites)
   - **Website restrictions**: Add your production domain(s):
     - `https://yourdomain.com/*`
     - `https://*.yourdomain.com/*`
     - For local development, add:
       - `http://localhost:*`
       - `http://127.0.0.1:*`
9. Under **API restrictions**, select **Restrict key** and choose:
   - Identity Toolkit API
   - Firebase Installations API
   - Firebase Remote Config API (if used)
10. Save the restrictions

### Additional Security Measures:

1. **Enable Firebase App Check** (Recommended):
   - Provides additional protection against abuse
   - Helps verify that requests come from your legitimate app
   - Configure in Firebase Console → App Check

2. **Monitor API Usage**:
   - Regularly check Firebase Console → Usage and billing
   - Set up alerts for unusual activity
   - Monitor API quota usage

3. **Environment Variables**:
   - Never commit `.env` files to version control
   - Use `.env.example` as a template
   - Keep production credentials secure

4. **Firestore Security Rules**:
   - Rules are deployed and enforced server-side
   - Regularly review and test security rules
   - Use the Firebase Emulator Suite for testing

5. **Authentication**:
   - Enforce strong password policies
   - Enable email verification for production
   - Consider enabling MFA for admin accounts

6. **Rate Limiting**:
   - Implement rate limiting for user creation
   - Consider using Firebase App Check for additional protection
   - Monitor for suspicious activity

## Security Checklist Before Deployment:

- [ ] Firebase API key is restricted in Firebase Console
- [ ] Environment variables are not committed to git
- [ ] `.env.local` is in `.gitignore`
- [ ] Firestore security rules are deployed and tested
- [ ] Password requirements are enforced
- [ ] Console.log statements are removed or gated for production
- [ ] Error messages don't expose sensitive information
- [ ] File uploads are validated (type and size)
- [ ] URLs are validated before being stored
- [ ] All external links use `rel="noopener noreferrer"`

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:
1. Do not create a public GitHub issue
2. Contact the project maintainers directly
3. Provide detailed information about the vulnerability
4. Allow time for the issue to be addressed before public disclosure

