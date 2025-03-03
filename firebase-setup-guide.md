# Firebase Setup Guide for Discord Video Compressor

This guide will help you set up Firebase for your Discord Video Compressor application.

## Current Configuration Status

Your Firebase project "Discord Compressor" is configured with the following details:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyAmmbeAXWpmhZcp_8s5q1mtrt_JwOETL8I",
  authDomain: "discord-compressor.firebaseapp.com",
  projectId: "discord-compressor",
  storageBucket: "discord-compressor.firebasestorage.app",
  messagingSenderId: "189940939386",
  appId: "1:189940939386:web:7ac9a3fd2d8c844ee899c3",
  measurementId: "G-W3EYZZRVN2",
};
```

This configuration has already been added to your script.js file.

## Step 1: Update Firebase Storage Rules

Currently, your Firebase Storage rules are set to deny all access. To make the video upload and download functionality work:

1. In the Firebase console, navigate to **Storage** in the left sidebar
2. Click on the **Rules** tab
3. Replace the existing rules with the following:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /compressed_videos/{fileName} {
      // Allow anyone to read compressed videos
      allow read: if true;

      // Allow uploads with size constraints
      allow create, update: if
          // File size limit of 100MB
          request.resource.size < 100 * 1024 * 1024 &&
          // Restrict to video files
          request.resource.contentType.matches("video/.*");
    }
  }
}
```

4. Click **Publish** to apply the rules

## Step 2: Initialize Firebase Storage

Your application is already set up to use Firebase Storage with the compat version of the SDK.

If you wish to switch to the newer modular SDK in the future, you'd need to update both the imports in your HTML and the code in script.js accordingly.

## Step 3: Test Your Application

1. Launch your application
2. Upload and compress a video
3. Verify that the video is uploaded to Firebase Storage by:
   - Going to your Firebase Console > Storage
   - Checking that videos appear in the "compressed_videos" folder
4. Test downloading a compressed video

## Troubleshooting

If uploads fail:

- Check the browser console for error messages
- Make sure the updated Storage Rules have been published
- Verify that the storageBucket is correct ("discord-compressor.firebasestorage.app")
- Check Firebase Storage > Usage to ensure you haven't hit any quota limits

## Additional Features to Consider

Now that Firebase is integrated, you could add:

1. **Video History**: Store metadata in Firestore to keep track of previously compressed videos
2. **User Authentication**: Add Firebase Auth to create user accounts and store user-specific videos
3. **Custom Storage Metadata**: Add metadata to your videos in Firebase Storage for better organization
4. **Cloud Functions**: Implement server-side processing for more advanced video compression

## Firebase Storage Limitations

Keep in mind the following Firebase Storage limitations:

- Free tier: 5GB storage, 1GB daily download
- File upload size limit: 50MB in the Web SDK (without resumable uploads)
- For larger files, consider implementing resumable uploads using the Firebase Storage API
