# Discord Video Compressor

A web application to compress videos for Discord, using FFmpeg.wasm for browser-based video compression.

## The Problem: SharedArrayBuffer Error

When running the application, you might encounter the error: `SharedArrayBuffer is not defined`.

This is because modern versions of FFmpeg.wasm use SharedArrayBuffer for better performance, but browsers have strict security requirements to enable this feature:

1. The page must be served over HTTPS
2. Specific security headers must be present:
   - `Cross-Origin-Opener-Policy: same-origin`
   - `Cross-Origin-Embedder-Policy: require-corp`

## Solution 1: Using Older FFmpeg.wasm (Quick Fix)

The application has been configured to use an older version of FFmpeg.wasm (0.9.8) that doesn't require SharedArrayBuffer. This should work in most browsers without special configuration.

To run this version:

1. Simply open the `index.html` file in your browser
2. Or use any basic web server to serve the files

## Solution 2: Using Proper Security Headers (Better Performance)

For better performance, you can use the included Express server that sets the required security headers:

1. Install Node.js if not already installed
2. Install dependencies:
   ```
   npm install
   ```
3. Start the server:
   ```
   npm start
   ```
4. Open `http://localhost:3000` in your browser

If you want to use the newer version of FFmpeg.wasm with this solution, update the index.html file:

```html
<!-- Replace the older FFmpeg.wasm library -->
<script src="https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js"></script>
```

And update the FFmpeg initialization in script.js:

```javascript
// Initialize FFmpeg
const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({
  log: true,
  corePath:
    "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js",
});
```

## How to Use

1. Select a video file using the file chooser
2. Select a target compression size (8MB, 16MB, 24MB, or 50MB)
3. Optionally check "Remove Audio" to create a silent video
4. Click "Compress Video"
5. Wait for the compression and upload to complete
6. Click "Download Compressed Video" to get your compressed video

## Note on Compression Quality

The application uses FFmpeg's libx264 codec with CRF (Constant Rate Factor) of 28, which provides a good balance between quality and file size. Smaller target sizes will result in lower video quality.
