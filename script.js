// Initialize Firebase
// Firebase configuration from project settings
const firebaseConfig = {
    apiKey: "AIzaSyAmmbeAXWpmhZcp_8s5q1mtrt_JwOETL8I",
    authDomain: "discord-compressor.firebaseapp.com",
    projectId: "discord-compressor",
    storageBucket: "discord-compressor.firebasestorage.app",
    messagingSenderId: "189940939386",
    appId: "1:189940939386:web:7ac9a3fd2d8c844ee899c3",
    measurementId: "G-W3EYZZRVN2"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const analytics = firebase.analytics();
const storage = firebase.storage();

// Initialize FFmpeg (newer version with SharedArrayBuffer support)
const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ 
    log: true,
    corePath: 'https://unpkg.com/@ffmpeg/core@0.10.0/dist/ffmpeg-core.js'
});

// Load FFmpeg
let ffmpegLoaded = false;
async function loadFFmpeg() {
    if (!ffmpegLoaded) {
        try {
            await ffmpeg.load();
            ffmpegLoaded = true;
            console.log('FFmpeg loaded successfully');
        } catch (error) {
            console.error('Error loading FFmpeg:', error);
            throw new Error('Failed to load video processing library: ' + error.message);
        }
    }
}

// Call this immediately to start loading in background
loadFFmpeg().catch(err => console.error('Error loading FFmpeg:', err));

document.addEventListener('DOMContentLoaded', () => {
    const videoInput = document.getElementById('videoInput');
    const fileName = document.getElementById('fileName');
    const sizeButtons = document.querySelectorAll('.size-btn');
    const removeAudio = document.getElementById('removeAudio');
    const compressBtn = document.getElementById('compressBtn');
    const progressSection = document.querySelector('.progress-section');
    const progressFill = document.querySelector('.progress-fill');
    const progressText = document.querySelector('.progress-text');
    const errorMessage = document.getElementById('error-message');
    const resultsSection = document.querySelector('.results-section');
    const originalSizeElement = document.getElementById('originalSize');
    const compressedSizeElement = document.getElementById('compressedSize');
    const sizeReductionElement = document.getElementById('sizeReduction');

    // Debug logging
    console.log("DOM elements loaded:", {
        videoInput: !!videoInput,
        fileName: !!fileName,
        sizeButtons: sizeButtons.length,
        compressBtn: !!compressBtn
    });

    let selectedFile = null;
    let selectedSize = null;
    let compressedVideoBlob = null;
    let videoInfo = null;

    // File input handler
    videoInput.addEventListener('change', (e) => {
        selectedFile = e.target.files[0];
        console.log("File selected:", selectedFile ? selectedFile.name : "none");
        
        if (selectedFile) {
            fileName.textContent = selectedFile.name;
            // Display original file size
            originalSizeElement.textContent = formatFileSize(selectedFile.size);
            // Make sure we enable the compress button only if a size is also selected
            compressBtn.disabled = !selectedSize;
            
            // Hide any previous error messages and results
            errorMessage.style.display = 'none';
            resultsSection.style.display = 'none';
        } else {
            fileName.textContent = '';
            compressBtn.disabled = true;
        }
    });

    // Size button handler
    sizeButtons.forEach(button => {
        button.addEventListener('click', () => {
            sizeButtons.forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            selectedSize = parseInt(button.dataset.size);
            console.log("Size selected:", selectedSize);
            
            // Enable compress button if a file is also selected
            if (selectedFile) {
                compressBtn.disabled = false;
            }
        });
    });

    // Compress button handler
    compressBtn.addEventListener('click', async () => {
        if (!selectedFile || !selectedSize) {
            console.error("Missing file or size selection");
            showError("Please select both a video file and compression size");
            return;
        }

        progressSection.style.display = 'block';
        compressBtn.disabled = true;
        console.log("Starting compression process for", selectedFile.name, "with target size", selectedSize, "MB");

        try {
            // Make sure FFmpeg is loaded
            if (!ffmpegLoaded) {
                progressText.textContent = 'Loading compression library...';
                try {
                    await loadFFmpeg();
                } catch (error) {
                    // Special handling for WASM-related errors
                    if (error.message.includes('SharedArrayBuffer') || 
                        error.message.includes('WebAssembly')) {
                        showError('Browser security restrictions are preventing video compression. ' + 
                                 'Please try a different browser or ensure you\'re using HTTPS with proper COOP/COEP headers.');
                        console.error('WASM loading error:', error);
                        resetCompressButton();
                        return;
                    } else {
                        // Re-throw other errors to be caught by the outer catch
                        throw error;
                    }
                }
            }

            // Real compression using FFmpeg.wasm
            progressText.textContent = 'Compressing video...';
            compressedVideoBlob = await compressVideo(selectedFile, selectedSize, removeAudio.checked, 
                (progress) => {
                    progressFill.style.width = `${progress}%`;
                    progressText.textContent = `Compressing: ${Math.round(progress)}%`;
                }
            );
            
            // Display compression results
            const originalSize = selectedFile.size;
            const compressedSize = compressedVideoBlob.size;
            const reduction = 100 - (compressedSize / originalSize * 100);
            
            compressedSizeElement.textContent = formatFileSize(compressedSize);
            sizeReductionElement.textContent = reduction.toFixed(1) + '%';
            resultsSection.style.display = 'block';
            
            console.log("Compression complete, file size:", compressedVideoBlob.size / (1024 * 1024), "MB");
            
            // Upload to Firebase Storage
            const uploadFileName = `compressed_${Date.now()}_${selectedFile.name}`;
            console.log("Uploading to path:", `compressed_videos/${uploadFileName}`);
            const storageRef = storage.ref(`compressed_videos/${uploadFileName}`);
            
            progressText.textContent = 'Uploading to cloud...';
            
            // Upload the compressed video
            const uploadTask = storageRef.put(compressedVideoBlob);
            
            // Monitor upload progress
            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    progressFill.style.width = `${progress}%`;
                    progressText.textContent = `Uploading: ${Math.round(progress)}%`;
                    console.log("Upload progress:", Math.round(progress) + "%");
                },
                (error) => {
                    console.error('Upload error:', error);
                    showError('An error occurred during upload: ' + error.message);
                    progressSection.style.display = 'none';
                    compressBtn.disabled = false;
                },
                () => {
                    // Upload completed successfully
                    console.log("Upload completed successfully");
                    progressText.textContent = 'Upload completed!';
                    compressBtn.textContent = 'Download Compressed Video';
                    compressBtn.disabled = false;
                    
                    // Store the download URL for later
                    uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                        console.log("Download URL:", downloadURL);
                        compressBtn.dataset.downloadUrl = downloadURL;
                        compressBtn.onclick = downloadCompressedVideo;
                    }).catch(error => {
                        console.error("Error getting download URL:", error);
                        showError("Error preparing download. Please try again.");
                        resetCompressButton();
                    });
                }
            );

        } catch (error) {
            console.error('Compression error:', error);
            showError('An error occurred during compression: ' + error.message);
            resetCompressButton();
        }
    });

    // Helper function to show error messages
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }

    // Helper function to reset the button state
    function resetCompressButton() {
        progressSection.style.display = 'none';
        resultsSection.style.display = 'none';
        compressBtn.disabled = false;
        compressBtn.textContent = 'Compress Video';
        compressBtn.onclick = null;
    }

    // Download handler
    function downloadCompressedVideo() {
        const downloadUrl = compressBtn.dataset.downloadUrl;
        
        if (downloadUrl) {
            console.log("Initiating download from URL:", downloadUrl);
            // Create a download link and click it
            const downloadLink = document.createElement('a');
            downloadLink.href = downloadUrl;
            downloadLink.target = '_blank';
            downloadLink.download = `compressed_${selectedFile.name}`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            // Reset the button
            setTimeout(() => {
                resetCompressButton();
                delete compressBtn.dataset.downloadUrl;
            }, 1000);
        } else {
            console.error("No download URL available");
            showError("Download URL not available. Please try again.");
        }
    }

    // Function to format file size
    function formatFileSize(bytes) {
        if (bytes < 1024 * 1024) {
            return (bytes / 1024).toFixed(2) + ' KB';
        } else {
            return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
        }
    }
});

// Video compression function using FFmpeg
async function compressVideo(file, targetSizeMB, removeAudio, progressCallback) {
    try {
        // Calculate target bitrate based on desired file size
        // This is a simplified approach - better algorithms exist for determining optimal settings
        const fileName = file.name;
        const fileExt = fileName.split('.').pop().toLowerCase();
        const inputFileName = `input.${fileExt}`;
        const outputFileName = `output.mp4`;
        
        // Get file as ArrayBuffer
        const fileData = await fetchFile(file);
        
        // Write the file to FFmpeg's virtual file system
        ffmpeg.FS('writeFile', inputFileName, fileData);
        
        // Estimate duration and calculate bitrate
        // In a real app, you'd want to extract the precise duration
        const originalSize = file.size;
        const durationEstimate = Math.max(10, (originalSize / (1024 * 1024)) * 5); // Rough estimate: 5 seconds per MB
        
        // Calculate target bitrate (in kbps)
        // Formula: (target size in kilobits) / (duration in seconds)
        const targetKilobits = targetSizeMB * 8 * 1024;
        const targetBitrate = Math.floor(targetKilobits / durationEstimate);
        
        console.log("Estimated duration:", durationEstimate, "seconds");
        console.log("Target bitrate:", targetBitrate, "kbps");
        
        // Simulate progress since older version doesn't provide progress callbacks
        let progress = 0;
        const interval = setInterval(() => {
            progress += 5;
            if (progress > 95) {
                clearInterval(interval);
            }
            progressCallback(progress);
        }, 500);
        
        // Set up compression parameters
        const compressionArgs = [
            '-i', inputFileName,
            '-b:v', `${Math.min(targetBitrate * 0.85, 2000)}k`, // Video bitrate (85% of target for audio overhead)
            '-maxrate', `${Math.min(targetBitrate * 1.5, 3000)}k`, // Max bitrate
            '-bufsize', `${Math.min(targetBitrate * 2, 4000)}k`, // Buffer size
            '-preset', 'medium', // Encoding preset (fast is a good balance)
            '-c:v', 'libx264', // Video codec
            '-crf', '28' // Quality (Higher = lower quality, 28 is a good balance for compression)
        ];
        
        // Handle audio based on user choice
        if (removeAudio) {
            compressionArgs.push('-an'); // Remove audio
        } else {
            compressionArgs.push('-c:a', 'aac', '-b:a', '128k'); // Compress audio
        }
        
        // Add output filename
        compressionArgs.push(outputFileName);
        
        console.log("FFmpeg command:", compressionArgs.join(' '));
        
        // Run FFmpeg compression
        await ffmpeg.run(...compressionArgs);
        
        // Clear the interval for progress
        clearInterval(interval);
        progressCallback(100);
        
        // Read the compressed file
        const data = ffmpeg.FS('readFile', outputFileName);
        
        // Clean up files in the virtual filesystem
        ffmpeg.FS('unlink', inputFileName);
        ffmpeg.FS('unlink', outputFileName);
        
        // Create a Blob from the compressed video data
        return new Blob([data.buffer], { type: 'video/mp4' });
    } catch (error) {
        console.error('Error in video compression:', error);
        throw new Error('Video compression failed: ' + error.message);
    }
}