// MediaPipe Face Mesh Implementation with Iris landmarks
let faceMesh = null;
let video = null;
let canvas = null;
let ctx = null;
let isMonitoring = false;
let startTime = null;
let focusTime = 0;
let distractionCount = 0;
let longestStreak = 0;
let currentStreakStart = null;
let currentStreak = 0;
let lastFaceDetected = Date.now();
let isCurrentlyFocused = false;
let faceDetectionInterval;

// Loading and initialization state
let isFullyLoaded = false;
let isMediaPipeReady = false;
let isFaceDetected = false;
let gazeDetectionEnabled = false;
let loadingSteps = {
    mediapipe: false,
    faceDetection: false,
    gifs: false
};

let lastLookAwayTime = 0;
let focusPausedTime = 0;
let lastGazePosition = null;
let gazeHistory = [];
let gazeStableTime = 0;
let minStableTime = 1000;
let eyesClosedStartTime = null;
let isEyesClosed = false;
let consecutiveClosedFrames = 0;
let isBlinking = false;
let blinkBuffer = [];
let lastBlinkTime = 0;
let isGifShowing = false;
let gifCooldownEndTime = 0;
let gifCooldownDuration = 2000;
let gifAutoHideTimeout = null;
let consecutiveMovementCount = 0;
// Mobile devices need lower consecutive requirement due to tracking instability
const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
let requiredConsecutiveMovements = isMobileDevice ? 1 : 2;

// Countdown variables
let countdownActive = false;
let countdownSeconds = 3;
let countdownInterval = null;

// PHP endpoint for GIF fetching
const GIPHY_ENDPOINT = 'giphy.php';

// Cache for GIFs to avoid repeated API calls
let gifCache = [];
let currentGifIndex = 0;

// MediaPipe Iris variables
let lastLeftEAR = null;
let lastRightEAR = null;
let lastEyePosition = null;
let lastIrisPosition = null;

// Timer pause/resume variables
let timerPaused = false;
let pauseStartTime = null;
let totalPauseTime = 0;
let pausedElapsedTime = 0; // Store elapsed time when paused

// Debug mode - check URL for debug parameter
const urlParams = new URLSearchParams(window.location.search);
const isDebugMode = urlParams.get('debug') === 'true';

console.log('🔍 Debug mode:', isDebugMode);
console.log('🔍 Current URL:', window.location.href);
console.log('🔍 URL params:', window.location.search);
console.log('📱 Mobile device detected:', isMobileDevice);
console.log('🎯 Required consecutive movements:', requiredConsecutiveMovements);

// Initialize MediaPipe Face Mesh
async function initializeMediaPipeFaceMesh() {
    console.log('🎯 Initializing MediaPipe Face Mesh...');
    
    // Get the video element
    video = document.getElementById('video');
    if (!video) {
        throw new Error('Video element not found');
    }

    // Initialize canvas for drawing with debug mode dimensions
    canvas = document.getElementById('debugCanvas');
    if (canvas) {
        ctx = canvas.getContext('2d');
        if (isDebugMode) {
            // Full screen dimensions for debug mode
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        } else {
            canvas.width = 640;
            canvas.height = 480;
        }
        console.log(`🎨 Canvas initialized: ${canvas.width}x${canvas.height} (debug: ${isDebugMode})`);
    }

    // Show debug camera feed only in debug mode
    const videoContainer = document.getElementById('mediapipeVideoContainer');
    if (isDebugMode && videoContainer) {
        videoContainer.style.display = 'block';
        videoContainer.classList.add('debug-fullscreen');
        console.log('📹 Debug camera feed enabled (FULL SCREEN)');
        
        // Update canvas CSS size for full screen debug mode
        if (canvas) {
            canvas.style.position = 'fixed';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.width = '100vw';
            canvas.style.height = '100vh';
            canvas.style.transform = 'none';
            canvas.style.border = 'none';
            console.log('📐 Canvas CSS size updated to FULL SCREEN for debug mode');
        }
    } else if (videoContainer) {
        videoContainer.style.display = 'none';
        videoContainer.classList.remove('debug-fullscreen');
        console.log('📹 Debug camera feed hidden (normal mode)');
    }

    // Create MediaPipe Face Mesh instance
    faceMesh = new FaceMesh({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
    });

    // Configure MediaPipe Face Mesh with iris refinement
    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true, // This enables iris landmarks
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    // Set up the camera
    faceMesh.onResults(onFaceMeshResults);

    // Start the camera with appropriate dimensions
    const cameraWidth = isDebugMode ? window.innerWidth : 640;
    const cameraHeight = isDebugMode ? window.innerHeight : 480;
    
    const camera = new Camera(video, {
        onFrame: async () => {
            await faceMesh.send({ image: video });
        },
        width: cameraWidth,
        height: cameraHeight
    });

    await camera.start();
    console.log('🎉 MediaPipe Face Mesh initialized successfully!');
}

// Handle MediaPipe Face Mesh results
function onFaceMeshResults(results) {
    // Clear canvas
    if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw video frame
        if (video && video.videoWidth > 0) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
    }

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const faceLandmarks = results.multiFaceLandmarks[0];
        
        // Draw face landmarks
        drawFaceLandmarks(faceLandmarks);
        
        // Draw iris landmarks
        drawIrisLandmarks(faceLandmarks);
        
        // Process iris landmarks for gaze tracking
        // MediaPipe Face Mesh with refineLandmarks: true provides iris landmarks
        processGazeTracking(faceLandmarks);
        
        // Update face detection status
        if (!isFaceDetected) {
            isFaceDetected = true;
            console.log('🎉 First face detection successful!');
            updateLoadingStatus('Face detection active!');
        }
        
        lastFaceDetected = Date.now();
    } else {
        // No face detected
        if (isFaceDetected) {
            isFaceDetected = false;
            console.log('⚠️ Face lost');
        }
    }
}

// Draw face landmarks
function drawFaceLandmarks(landmarks) {
    if (!ctx) return;
    
    // Draw all face landmarks
    ctx.fillStyle = 'rgba(0, 255, 0, 0.6)';
    landmarks.forEach((landmark, index) => {
        const x = landmark.x * canvas.width;
        const y = landmark.y * canvas.height;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.fill();
    });
}

// Draw iris landmarks from face mesh
function drawIrisLandmarks(landmarks) {
    if (!ctx) return;
    
    // MediaPipe Face Mesh iris landmarks (468-477 for left eye, 473-477 for right eye)
    const leftIrisIndices = [468, 469, 470, 471, 472];
    const rightIrisIndices = [473, 474, 475, 476, 477];
    
    // Draw left iris landmarks
    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
    leftIrisIndices.forEach(index => {
        if (landmarks[index]) {
            const x = landmarks[index].x * canvas.width;
            const y = landmarks[index].y * canvas.height;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();
        }
    });
    
    // Draw right iris landmarks
    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
    rightIrisIndices.forEach(index => {
        if (landmarks[index]) {
            const x = landmarks[index].x * canvas.width;
            const y = landmarks[index].y * canvas.height;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();
        }
    });
    
    // Draw iris centers
    const leftIrisCenter = getIrisCenter(landmarks, leftIrisIndices);
    const rightIrisCenter = getIrisCenter(landmarks, rightIrisIndices);
    
    if (leftIrisCenter) {
        ctx.fillStyle = 'rgba(255, 255, 0, 1)';
        ctx.beginPath();
        ctx.arc(leftIrisCenter.x * canvas.width, leftIrisCenter.y * canvas.height, 6, 0, 2 * Math.PI);
        ctx.fill();
    }
    
    if (rightIrisCenter) {
        ctx.fillStyle = 'rgba(255, 255, 0, 1)';
        ctx.beginPath();
        ctx.arc(rightIrisCenter.x * canvas.width, rightIrisCenter.y * canvas.height, 6, 0, 2 * Math.PI);
        ctx.fill();
    }
}

// Get iris center from landmarks
function getIrisCenter(landmarks, indices) {
    let sumX = 0, sumY = 0, count = 0;
    
    indices.forEach(index => {
        if (landmarks[index]) {
            sumX += landmarks[index].x;
            sumY += landmarks[index].y;
            count++;
        }
    });
    
    if (count > 0) {
        return {
            x: sumX / count,
            y: sumY / count
        };
    }
    
    return null;
}

// Process gaze tracking
function processGazeTracking(landmarks) {
    if (!isMonitoring || !gazeDetectionEnabled) return;
    
    // Get iris landmarks from face mesh
    const leftIrisIndices = [468, 469, 470, 471, 472];
    const rightIrisIndices = [473, 474, 475, 476, 477];
    
    const leftIrisCenter = getIrisCenter(landmarks, leftIrisIndices);
    const rightIrisCenter = getIrisCenter(landmarks, rightIrisIndices);
    
    if (!leftIrisCenter || !rightIrisCenter) return;
    
    // Calculate average iris center in normalized coordinates (0-1 range)
    const irisCenter = {
        x: (leftIrisCenter.x + rightIrisCenter.x) / 2,
        y: (leftIrisCenter.y + rightIrisCenter.y) / 2
    };
    
    // Use normalized coordinates directly - device independent!
    // No pixel conversion needed
    
    // Check for gaze direction changes (left/right/up/down)
    let gazeDirectionChanged = false;
    if (lastIrisPosition) {
        // Calculate movement in normalized space (0-1 range)
        const deltaX = irisCenter.x - lastIrisPosition.x;
        const deltaY = irisCenter.y - lastIrisPosition.y;
        
        // Thresholds in normalized coordinates (0-1 range)
        // These work consistently across ALL devices!

        let horizontalThreshold = 0.001; // 0.15% of frame width
        let verticalThreshold = 0.0005; // 0.1% of frame height

        if(isMobileDevice) {
            horizontalThreshold = 0.0015; // 0.15% of frame width
            verticalThreshold = 0.0010; // 0.1% of frame height
        }
        
        // Check for significant gaze direction changes
        const horizontalMovement = Math.abs(deltaX) > horizontalThreshold;
        const verticalMovement = Math.abs(deltaY) > verticalThreshold;
        
        gazeDirectionChanged = horizontalMovement || verticalMovement;
        
        // Determine gaze direction
        let direction = '';
        if (horizontalMovement && verticalMovement) {
            direction = deltaX > 0 ? (deltaY > 0 ? 'right-down' : 'right-up') : (deltaY > 0 ? 'left-down' : 'left-up');
        } else if (horizontalMovement) {
            direction = deltaX > 0 ? 'right' : 'left';
        } else if (verticalMovement) {
            direction = deltaY > 0 ? 'down' : 'up';
        }
        
        console.log(`👁️ Gaze direction: ${direction} | deltaX=${(deltaX * 100).toFixed(2)}% (H:${(horizontalThreshold * 100).toFixed(1)}%), deltaY=${(deltaY * 100).toFixed(2)}% (V:${(verticalThreshold * 100).toFixed(1)}%), changed=${gazeDirectionChanged}`);
        
        if (gazeDirectionChanged) {
            consecutiveMovementCount++;
            console.log(`👁️ Gaze direction change detected: ${consecutiveMovementCount}/${requiredConsecutiveMovements} (${direction})`);
        } else {
            consecutiveMovementCount = Math.max(0, consecutiveMovementCount - 1);
        }
    }
    
    // Store normalized coordinates
    lastIrisPosition = { x: irisCenter.x, y: irisCenter.y };
    
    // Update focus status
    const now = Date.now();
    
    if (consecutiveMovementCount >= requiredConsecutiveMovements) {
        if (isCurrentlyFocused) {
            isCurrentlyFocused = false;
            lastLookAwayTime = now;
            distractionCount++;
            updateCurrentStreak();
            
            console.log('😞 Triggering disappointment GIF due to gaze direction change');
            
            if (!isGifShowing) {
                showDisappointmentGif();
            }
        }
    }
    // Remove automatic restart - user must click Try Again button
}

// Start monitoring
async function startMonitoring() {
    console.log('🔍 startMonitoring() called');
    
    try {
        // Set timeout for model loading
        const modelTimeout = setTimeout(() => {
            console.error('⏰ MediaPipe Iris model loading timeout');
            updateLoadingStatus('Model loading failed');
        }, 15000);
        
        updateLoadingStatus('Initializing eye tracking...');
        
        // Initialize MediaPipe Face Mesh
        await initializeMediaPipeFaceMesh();
        
        clearTimeout(modelTimeout);
        
        updateLoadingStatus('Eye tracking ready!');
        console.log('🎉 MediaPipe Face Mesh initialization completed successfully!');
        
        // Mark as ready
        loadingSteps.mediapipe = true;
        loadingSteps.faceDetection = true;
        
        checkLoadingComplete();
        
    } catch (error) {
        console.error('❌ MediaPipe Face Mesh initialization failed:', error);
        updateLoadingStatus('Eye tracking failed');
    }
}

// Update loading status
function updateLoadingStatus(message) {
    const statusElement = document.getElementById('loadingStatus');
    if (statusElement) {
        statusElement.textContent = message;
    }
    console.log('📝 Updating loading status:', message);
}

// Check if loading is complete
function checkLoadingComplete() {
    console.log('🔍 checkLoadingComplete() called');
    console.log('📊 Current loading steps:', loadingSteps);
    console.log('📊 isFullyLoaded:', isFullyLoaded);
    
    const allComplete = Object.values(loadingSteps).every(step => step === true);
    console.log('✅ All steps complete:', allComplete);
    
    if (allComplete && !isFullyLoaded) {
        console.log('🎉 All loading steps completed! Setting isFullyLoaded to true');
        isFullyLoaded = true;
        
        // Start countdown after a short delay
        setTimeout(() => {
            console.log('🚀 Starting countdown!');
            startCountdown();
        }, 500);
    } else if (!allComplete) {
        console.log('⏳ Not all steps complete yet, waiting...');
        const missingSteps = Object.keys(loadingSteps).filter(step => !loadingSteps[step]);
        console.log('📊 Missing steps:', missingSteps);
    }
}

// Start countdown
function startCountdown() {
    console.log('🚀 startCountdown() called');
    countdownActive = true;
    countdownSeconds = 3;
    
    const countdownElement = document.getElementById('countdownTimer');
    if (countdownElement) {
        countdownElement.style.display = 'flex';
        countdownElement.style.alignItems = 'center';
        countdownElement.style.justifyContent = 'center';
        countdownElement.textContent = countdownSeconds;
        console.log('📱 Countdown timer element updated:', countdownSeconds);
    }
    
    countdownInterval = setInterval(() => {
        countdownSeconds--;
        if (countdownElement) {
            countdownElement.textContent = countdownSeconds;
        }
        console.log('⏰ Countdown:', countdownSeconds);
        
        if (countdownSeconds <= 0) {
            clearInterval(countdownInterval);
            countdownActive = false;
            console.log('🎉 Countdown finished! Starting timer...');
            
            // Hide loading screen
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) {
                loadingScreen.style.display = 'none';
                console.log('📱 Loading screen hidden');
            }
            
            startTimer();
        }
    }, 1000);
}

// Start timer
function startTimer() {
    console.log('🚀 Starting timer...');
    isMonitoring = true;
    startTime = Date.now();
    isCurrentlyFocused = true;
    currentStreakStart = Date.now();
    gazeDetectionEnabled = true;
    
    // Reset timer pause variables
    timerPaused = false;
    pauseStartTime = null;
    totalPauseTime = 0;
    pausedElapsedTime = 0;
    
    console.log('⏰ Timer started, isMonitoring:', isMonitoring);
    console.log('👁️ isCurrentlyFocused:', isCurrentlyFocused);
    
    // Set up timer interval
    const timerInterval = setInterval(() => {
        if (isMonitoring) {
            updateTimer();
        } else {
            clearInterval(timerInterval);
        }
    }, 1000);
    
    console.log('✅ Timer interval set up');
}

// Pause timer
function pauseTimer() {
    if (!timerPaused) {
        timerPaused = true;
        pauseStartTime = Date.now();
        
        // Store the current elapsed time when pausing
        const now = Date.now();
        pausedElapsedTime = Math.floor((now - startTime) / 1000);
        
        console.log('⏸️ Timer paused at:', pausedElapsedTime, 'seconds');
    }
}

// Resume timer
function resumeTimer() {
    if (timerPaused) {
        timerPaused = false;
        if (pauseStartTime) {
            totalPauseTime += Date.now() - pauseStartTime;
            pauseStartTime = null;
        }
        console.log('▶️ Timer resumed');
    }
}

// Update timer display
function updateTimer() {
    if (!isMonitoring || !startTime) return;
    
    // Don't update timer if it's paused
    if (timerPaused) {
        console.log('⏸️ Timer is paused, skipping update');
        return;
    }
    
    const now = Date.now();
    const elapsed = Math.floor((now - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    const timerElement = document.getElementById('focusDot');
    if (timerElement) {
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    console.log(`⏰ Timer update: ${minutes}:${seconds.toString().padStart(2, '0')} isCurrentlyFocused: ${isCurrentlyFocused}`);
}

// Update current streak
function updateCurrentStreak() {
    if (currentStreakStart) {
        const streakDuration = Math.floor((Date.now() - currentStreakStart) / 1000);
        currentStreak = Math.max(currentStreak, streakDuration);
        longestStreak = Math.max(longestStreak, currentStreak);
        currentStreakStart = null;
    }
}

// Show disappointment GIF
function showDisappointmentGif() {
    console.log('🎬 showDisappointmentGif() called');
    console.log('🎬 isGifShowing:', isGifShowing);
    console.log('🎬 gifCache length:', gifCache.length);
    
    if (isGifShowing) {
        console.log('🎬 GIF already showing, skipping');
        return;
    }
    
    isGifShowing = true;
    gifCooldownEndTime = 0; // Remove cooldown period
    
    // Select a random GIF
    const randomGif = gifCache[Math.floor(Math.random() * gifCache.length)];
    console.log('🎬 Selected GIF:', randomGif);
    
    // Show GIF using backgroundGif element
    const gifElement = document.getElementById('backgroundGif');
    console.log('🎬 Background GIF element found:', !!gifElement);
    
    if (gifElement && randomGif) {
        gifElement.src = randomGif;
        gifElement.style.display = 'block';
        gifElement.classList.add('show');
        console.log('🎬 Background GIF displayed successfully!');
        
        // Show button container
        const buttonContainer = document.getElementById('buttonContainer');
        if (buttonContainer) {
            buttonContainer.style.display = 'flex';
        }
        
        // Pause timer when GIF is shown
        pauseTimer();
        
        // GIF stays visible until user clicks Try Again - no auto-hide
    } else {
        console.error('🎬 Failed to show GIF - element or URL missing');
        isGifShowing = false;
    }
}

// Stop monitoring
function stopMonitoring() {
    console.log('🛑 Stopping monitoring...');
    isMonitoring = false;
    gazeDetectionEnabled = false;
    
    if (video && video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }
    
    // Hide debug canvas
    if (canvas) {
        canvas.style.display = 'none';
    }
}

// Try again function
function tryAgain() {
    console.log('🔄 Try again clicked');
    
    // Reset state
    consecutiveMovementCount = 0;
    lastIrisPosition = null;
    gifCooldownEndTime = 0; // Remove cooldown period
    
    // Reset all gaze tracking variables for fresh detection
    lastLeftEAR = null;
    lastRightEAR = null;
    lastEyePosition = null;
    
    // Hide GIF using backgroundGif element
    const gifElement = document.getElementById('backgroundGif');
    if (gifElement) {
        gifElement.style.display = 'none';
        gifElement.classList.remove('show');
    }
    
    // Hide button container
    const buttonContainer = document.getElementById('buttonContainer');
    if (buttonContainer) {
        buttonContainer.style.display = 'none';
    }
    
    isGifShowing = false;
    
    // Reset timer variables
    timerPaused = false;
    pauseStartTime = null;
    totalPauseTime = 0;
    pausedElapsedTime = 0;
    
    // Reset timer display
    const timerElement = document.getElementById('focusDot');
    if (timerElement) {
        timerElement.textContent = '0:00';
    }
    
    // Restart timer
    startTimer();
}

// Registration modal functions
function showRegistrationModal() {
    const modal = document.getElementById('registrationModal');
    const finalTimeSpan = document.getElementById('finalTime');
    
    // Use paused elapsed time if timer is paused, otherwise calculate current time
    let elapsed;
    if (timerPaused) {
        elapsed = pausedElapsedTime;
    } else {
        const now = Date.now();
        elapsed = Math.floor((now - startTime) / 1000);
    }
    
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    finalTimeSpan.textContent = timeString;
    modal.style.display = 'flex';

    // Focus on input
    setTimeout(() => {
        document.getElementById('playerName').focus();
    }, 100);
}

function hideRegistrationModal() {
    const modal = document.getElementById('registrationModal');
    modal.style.display = 'none';
}

async function submitScore() {
    const name = document.getElementById('playerName').value.trim();
    
    // Use paused elapsed time if timer is paused, otherwise calculate current time
    let elapsed;
    if (timerPaused) {
        elapsed = pausedElapsedTime;
    } else {
        const now = Date.now();
        elapsed = Math.floor((now - startTime) / 1000);
    }

    if (!name) {
        alert('Please enter your name!');
        return;
    }

    try {
        const response = await fetch('leaderboard.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: name,
                time: elapsed
            })
        });

        const result = await response.json();

        if (result.success) {
            // Store the submitted score for highlighting
            localStorage.setItem('highlightScore', JSON.stringify({
                name: name,
                time: elapsed,
                timestamp: Date.now()
            }));

            // Redirect to leaderboard
            window.location.href = 'leaderboard.html';
        } else {
            alert('Failed to register score: ' + result.message);
        }
    } catch (error) {
        alert('Failed to register score. Please try again.');
    }
}

// Initialize when page loads
window.addEventListener('load', () => {
    console.log('🌐 Window load event triggered');
    
    // Ensure GIF is hidden on startup
    const gifElement = document.getElementById('backgroundGif');
    if (gifElement) {
        gifElement.style.display = 'none';
        gifElement.classList.remove('show');
        console.log('🎬 Ensuring background GIF is hidden on startup');
    }
    
    // Load GIFs
    updateLoadingStatus('Loading GIFs...');
    console.log('🎬 Fetching disappointed GIFs...');
    
    fetch(GIPHY_ENDPOINT)
        .then(response => response.json())
        .then(data => {
            gifCache = data.gifs || [];
            console.log('✅ GIFs loaded successfully');
            updateLoadingStatus('GIFs loaded!');
            loadingSteps.gifs = true;
            checkLoadingComplete();
        })
        .catch(error => {
            console.error('❌ Failed to load GIFs:', error);
            updateLoadingStatus('GIF loading failed');
        });
    
    // Start monitoring
    console.log('🎯 Starting monitoring...');
    startMonitoring();
});
