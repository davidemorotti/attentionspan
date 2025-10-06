let video = null, canvas, ctx;
let isMonitoring = false;
let startTime = null;
let focusTime = 0;
let distractionCount = 0;
let longestStreak = 0;
let currentStreakStart = null;
let currentStreak = 0;
let lastFaceDetected = Date.now();
let isCurrentlyFocused = false; // Start as not focused until timer begins
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
let gazeHistory = []; // For smoothing gaze data (buffer size: 5)
let gazeStableTime = 0; // Track how long gaze has been stable
let minStableTime = 1000; // Minimum 1 second of stability before restarting timer (reduced from 2 seconds)
let gazeMovementThreshold = (window.innerWidth < 768) ? 5 : 15; // pixels - more sensitive for both mobile and desktop
let eyesClosedStartTime = null;
let isEyesClosed = false;
let consecutiveClosedFrames = 0;
let isBlinking = false;
let blinkBuffer = [];
let lastBlinkTime = 0;
let isGifShowing = false;
let gifCooldownEndTime = 0;
let gifCooldownDuration = 2000; // 2 seconds cooldown after GIF hides
let gifAutoHideTimeout = null;
let consecutiveMovementCount = 0;
let requiredConsecutiveMovements = 1; // Require 1 movement before triggering

// Countdown variables
let countdownActive = false;
let countdownSeconds = 5;
let countdownInterval = null;

// PHP endpoint for GIF fetching
const GIPHY_ENDPOINT = 'giphy.php';

// Cache for GIFs to avoid repeated API calls
let gifCache = [];
let currentGifIndex = 0;

// MediaPipe variables
let faceMesh = null;
let camera = null;
let lastLeftEAR = null;
let lastRightEAR = null;
let lastEyePosition = null;

// Function to fetch random disappointed GIFs from Giphy API
async function fetchDisappointedGifs() {
    try {
        const keywords = ['disappointed', 'facepalm', 'eyeroll', 'sigh', 'frustrated', 'annoyed', 'upset'];
        const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];

        const response = await fetch(`${GIPHY_ENDPOINT}?keyword=${encodeURIComponent(randomKeyword)}&limit=20`);
        const data = await response.json();

        if (data.success && data.gifs && data.gifs.length > 0) {
            gifCache = data.gifs;
            return gifCache;
        } else {
            return getFallbackGifs();
        }
    } catch (error) {
        return getFallbackGifs();
    }
}

// Fallback GIFs in case API fails
function getFallbackGifs() {
    return [
        "https://media.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif",
        "https://media.giphy.com/media/26BRrSvJUa5yIYjSU/giphy.gif",
        "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
        "https://media.giphy.com/media/3o7aTskHEUdgCQAXde/giphy.gif",
        "https://media.giphy.com/media/26BRv0ZflZagFW7Es/giphy.gif"
    ];
}

// Function to get random disappointed GIF
async function getRandomDisappointedGif() {
    // If cache is empty or we've used all GIFs, fetch new ones
    if (gifCache.length === 0 || currentGifIndex >= gifCache.length) {
        await fetchDisappointedGifs();
        currentGifIndex = 0;
    }

    // Return current GIF and move to next
    const gif = gifCache[currentGifIndex];
    currentGifIndex++;

    return gif;
}

function updateLoadingStatus(message) {
    const statusElement = document.getElementById('loadingStatus');
    if (statusElement) {
        statusElement.textContent = message;
    }
}

// Add timeout for model loading
let modelLoadingTimeout = null;

function startModelLoadingTimeout() {
    // If models don't load within 15 seconds, show error
    modelLoadingTimeout = setTimeout(() => {
        if (!isFullyLoaded) {
            showErrorModal('Eye tracking models are taking too long to load. This may be due to:\n\n• Slow internet connection\n• Device compatibility issues\n• Browser limitations\n\nPlease try refreshing the page or using a different browser.');
        }
    }, 15000); // 15 second timeout
}

// Add error modal function
function showErrorModal(message) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>⚠️ Eye Tracking Required</h2>
            <p style="white-space: pre-line;">${message}</p>
            <div class="modal-buttons">
                <button onclick="location.reload()">🔄 Refresh Page</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function checkLoadingComplete() {
    console.log('🔍 checkLoadingComplete() called');
    console.log('📊 Current loading steps:', loadingSteps);
    console.log('📊 isFullyLoaded:', isFullyLoaded);

    const allStepsComplete = Object.values(loadingSteps).every(step => step === true);
    console.log('✅ All steps complete:', allStepsComplete);

    if (allStepsComplete && !isFullyLoaded) {
        console.log('🎉 All loading steps completed! Setting isFullyLoaded to true');
        isFullyLoaded = true;

        // Start countdown immediately after loading completes
        console.log('⏰ Setting 500ms timeout before starting countdown...');
        setTimeout(() => {
            console.log('🚀 Starting countdown!');
            startCountdown();
        }, 500);
    } else {
        console.log('⏳ Not all steps complete yet, waiting...');
        console.log('📊 Missing steps:', Object.entries(loadingSteps).filter(([key, value]) => !value).map(([key]) => key));
    }
}

function startCountdown() {
    countdownActive = true;
    countdownSeconds = 5;

    // Remove spinner and start countdown
    const countdownTimer = document.getElementById('countdownTimer');
    if (countdownTimer) {
        // Clear spinner and set countdown
        countdownTimer.innerHTML = '';
        countdownTimer.textContent = countdownSeconds;
        countdownTimer.style.display = 'flex';
        countdownTimer.style.alignItems = 'center';
        countdownTimer.style.justifyContent = 'center';
    }

    countdownInterval = setInterval(() => {
        countdownSeconds--;

        if (countdownSeconds > 0) {
            countdownTimer.textContent = countdownSeconds;
        } else {
            // Countdown finished - hide loading screen and start timer
            clearInterval(countdownInterval);
            countdownActive = false;

            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) {
                loadingScreen.classList.add('hidden');
            }

            // Start actual timer
            startTimer();

            // Set grace period after countdown to prevent immediate disappointment
            gifCooldownEndTime = Date.now() + 3000; // 3 seconds grace period

            gazeDetectionEnabled = true;
        }
    }, 1000);
}

function startTimer() {
    isMonitoring = true;
    isCurrentlyFocused = true; // Set focus to true when timer starts
    startTime = Date.now();
    currentStreakStart = Date.now();
    lastFaceDetected = Date.now();

    // Update timer
    setInterval(updateTimer, 1000);
}

async function startMonitoring() {
    console.log('🔍 startMonitoring() called');
    try {
        console.log('⏰ Starting model loading timeout (15 seconds)');
        startModelLoadingTimeout();
        console.log('📝 Updating loading status: Initializing eye tracking...');
        updateLoadingStatus('Initializing eye tracking...');

        console.log('⏳ Setting 3-second timeout for MediaPipe initialization...');
        // Wait for MediaPipe to load and initialize eye tracking
        setTimeout(async () => {
            console.log('🚀 MediaPipe initialization timeout reached (3 seconds)');
            try {
                console.log('🔍 Checking if FaceMesh is defined...');
                if (typeof FaceMesh !== 'undefined') {
                    console.log('✅ FaceMesh is defined, proceeding with initialization');
                    console.log('📝 Updating loading status: Loading MediaPipe models...');
                    updateLoadingStatus('Loading MediaPipe models...');

                    console.log('🎯 Starting MediaPipe configuration...');
                    await initializeFaceMesh();
                    
                    console.log('🎉 MediaPipe initialization completed successfully!');
                    document.getElementById('gazeTracking').textContent = 'Ready';
                    console.log('📝 Updating loading status: Eye tracking ready!');
                    updateLoadingStatus('Eye tracking ready!');

                    // Mark MediaPipe as ready
                    console.log('✅ Marking MediaPipe as ready');
                    loadingSteps.mediapipe = true;
                    
                    // Mark face detection as ready since camera is initialized
                    // We'll update this to true when we actually detect a face
                    loadingSteps.faceDetection = true;
                    console.log('✅ Marking face detection as ready (camera initialized)');
                    
                    console.log('🔍 Checking loading complete...');
                    checkLoadingComplete();
                } else {
                    console.log('❌ FaceMesh is not defined/loaded');
                    document.getElementById('gazeTracking').textContent = 'MediaPipe not loaded';
                    console.log('📝 Updating loading status: Eye tracking library not loaded. Please refresh and try again.');
                    updateLoadingStatus('Eye tracking library not loaded. Please refresh and try again.');

                    // Show error message to user
                    console.log('🚨 Showing error modal for MediaPipe not loaded');
                    showErrorModal('Eye tracking library failed to load. Please refresh the page and try again.');
                }
            } catch (err) {
                console.error('❌ MediaPipe error in try-catch:', err);
                console.log('📝 Error details:', {
                    message: err.message,
                    stack: err.stack,
                    name: err.name
                });
                document.getElementById('gazeTracking').textContent = 'Error';
                console.log('📝 Updating loading status: Eye tracking error. Please refresh and try again.');
                updateLoadingStatus('Eye tracking error. Please refresh and try again.');

                // Show error message to user
                console.log('🚨 Showing error modal for MediaPipe error');
                showErrorModal('Eye tracking encountered an error. Please refresh the page and try again.');
            }
        }, 3000); // Wait 3 seconds for MediaPipe to load

    } catch (error) {
        console.error('❌ Error starting monitoring:', error);
        console.log('📝 Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        console.log('📝 Updating loading status: Failed to start monitoring. Please refresh and try again.');
        updateLoadingStatus('Failed to start monitoring. Please refresh and try again.');

        // Show error message to user
        console.log('🚨 Showing error modal for monitoring start failure');
        showErrorModal('Failed to start monitoring. Please check camera permissions and try again.');
    }
}

function stopMonitoring() {
    isMonitoring = false;

    // Stop MediaPipe camera
    if (camera) {
        camera.stop();
    }

    // Stop video stream
    if (video && video.srcObject) {
        const stream = video.srcObject;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }

    // Hide MediaPipe video container
    const mediapipeContainer = document.getElementById('mediapipeVideoContainer');
    if (mediapipeContainer) {
        mediapipeContainer.style.display = 'none';
    }

    document.getElementById('debugOverlay').style.display = 'none';

    hideDisappointmentGif();
}

function detectGazeMovement(currentGaze) {
    // Don't process gaze movements until everything is loaded and gaze detection is enabled
    if (!isFullyLoaded || !gazeDetectionEnabled) {
        return;
    }

    // Pause tracking when GIF is showing - don't process any gaze events
    if (isGifShowing) {
        return;
    }

    // Ignore events during cooldown period after GIF hides (but allow focus detection)
    const now = Date.now();
    if (now < gifCooldownEndTime) {
        return;
    }

    // Add to gaze history for smoothing
    gazeHistory.push(currentGaze);
    if (gazeHistory.length > 5) { // Even smaller buffer for more responsive detection
        gazeHistory.shift();
    }

    // Calculate smoothed gaze position
    const smoothedGaze = {
        x: gazeHistory.reduce((sum, g) => sum + g.x, 0) / gazeHistory.length,
        y: gazeHistory.reduce((sum, g) => sum + g.y, 0) / gazeHistory.length
    };

    if (lastGazePosition === null) {
        lastGazePosition = smoothedGaze;
        return;
    }

    // Calculate movement distance
    const deltaX = Math.abs(smoothedGaze.x - lastGazePosition.x);
    const deltaY = Math.abs(smoothedGaze.y - lastGazePosition.y);
    const totalMovement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Calculate directional movement
    const rawDeltaX = smoothedGaze.x - lastGazePosition.x;
    const rawDeltaY = smoothedGaze.y - lastGazePosition.y;

    // Determine direction
    let direction = '';
    if (Math.abs(rawDeltaX) > Math.abs(rawDeltaY)) {
        direction = rawDeltaX > 0 ? 'RIGHT' : 'LEFT';
    } else {
        direction = rawDeltaY > 0 ? 'DOWN' : 'UP';
    }

    // Check if gaze moved significantly - adjust threshold based on direction
    let adjustedThreshold = gazeMovementThreshold;
    if (direction === 'UP') {
        adjustedThreshold = gazeMovementThreshold * 0.6; // More sensitive to UP movements
    }
    const gazeMoved = totalMovement > adjustedThreshold;

    // Update debug display
    if (document.getElementById('gazeMoved')) {
        document.getElementById('gazeMoved').textContent = gazeMoved ? 'Yes' : 'No';
    }
    if (document.getElementById('movementX')) {
        document.getElementById('movementX').textContent = `${rawDeltaX.toFixed(1)} (${direction})`;
    }
    if (document.getElementById('movementY')) {
        document.getElementById('movementY').textContent = `${rawDeltaY.toFixed(1)}`;
    }
    if (document.getElementById('gazePosition')) {
        document.getElementById('gazePosition').textContent = `(${smoothedGaze.x.toFixed(0)}, ${smoothedGaze.y.toFixed(0)})`;
    }
    if (document.getElementById('focusStatus')) {
        document.getElementById('focusStatus').textContent = isCurrentlyFocused ? 'Focused' : 'Distracted';
    }

    if (gazeMoved) {
        consecutiveMovementCount++;

        if (isCurrentlyFocused && consecutiveMovementCount >= requiredConsecutiveMovements) {
            isCurrentlyFocused = false;
            lastLookAwayTime = now;
            gazeStableTime = 0; // Reset stability timer

            // Only show GIF if not already showing one
            if (!isGifShowing) {
                showDisappointmentGif();
            }
        }
    } else {
        // Reset consecutive movement counter when gaze is stable
        consecutiveMovementCount = 0;

        // Gaze is stable - but don't auto-restart timer when GIF is showing
        // User must click Try Again button to restart
        if (!isCurrentlyFocused && !isGifShowing) {
            gazeStableTime += 100; // Assume ~10fps, so ~100ms per call

            // Only restart timer after minimum stable time
            if (gazeStableTime >= minStableTime) {
                isCurrentlyFocused = true;
                startTime = Date.now();
                currentStreakStart = Date.now();
                focusPausedTime = 0;
                lastLookAwayTime = 0;
                gazeStableTime = 0;
                consecutiveMovementCount = 0; // Reset counter when restarting
            }
        }
    }

    lastGazePosition = smoothedGaze;
}

function detectEyeGaze(landmarks) {
    // Eye landmark indices for MediaPipe Face Mesh
    const leftEye = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
    const rightEye = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];

    // Calculate eye aspect ratio (EAR) for both eyes
    const leftEAR = calculateEyeAspectRatio(landmarks, leftEye);
    const rightEAR = calculateEyeAspectRatio(landmarks, rightEye);
    const avgEAR = (leftEAR + rightEAR) / 2;

    // Add current EAR to blink buffer (keep last 15 frames for better smoothing)
    blinkBuffer.push(avgEAR);
    if (blinkBuffer.length > 15) {
        blinkBuffer.shift();
    }

    // Calculate average EAR over the buffer to smooth out blinks
    const avgBufferEAR = blinkBuffer.reduce((sum, ear) => sum + ear, 0) / blinkBuffer.length;
    const currentEyesOpen = avgEAR > 0.2; // Current frame eyes open status (lowered threshold)
    const bufferEyesOpen = avgBufferEAR > 0.2; // Buffer average eyes open status (lowered threshold)

    // Detect blinks vs sustained closure
    if (!currentEyesOpen) {
        consecutiveClosedFrames++;
    } else {
        consecutiveClosedFrames = 0;
        isBlinking = false;
    }

    // If eyes are closed for 1-3 frames, it's likely a blink (reduced range for better detection)
    if (consecutiveClosedFrames >= 1 && consecutiveClosedFrames <= 3) {
        isBlinking = true;
    }

    // Only consider eyes truly closed if they've been closed for more than 3 frames
    const eyesOpen = bufferEyesOpen && !isBlinking;

    // Calculate eye position for gaze direction detection (viewport coordinates)
    const leftEyeCenter = getEyeCenter(landmarks, leftEye);
    const rightEyeCenter = getEyeCenter(landmarks, rightEye);

    // Convert normalized coordinates to viewport coordinates
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const eyeCenter = {
        x: ((leftEyeCenter.x + rightEyeCenter.x) / 2) * viewportWidth,
        y: ((leftEyeCenter.y + rightEyeCenter.y) / 2) * viewportHeight,
        z: (leftEyeCenter.z + rightEyeCenter.z) / 2
    };

    // Check if EAR has changed significantly (indicating eye movement)
    let eyesMoved = false;
    let leftEARChange = 0;
    let rightEARChange = 0;
    let gazeMoved = false;

    // Only check for movement if we have previous values and enough buffer data
    if (lastLeftEAR !== null && lastRightEAR !== null && blinkBuffer.length >= 10) {
        leftEARChange = Math.abs(leftEAR - lastLeftEAR);
        rightEARChange = Math.abs(rightEAR - lastRightEAR);
        // Much higher threshold to reduce sensitivity to small movements and blinks
        eyesMoved = leftEARChange > 0.15 || rightEARChange > 0.15; // 15% EAR change threshold - more sensitive
    }

    // Check for gaze direction changes (looking up/down/left/right)
    if (lastGazePosition !== null && blinkBuffer.length >= 3) {
        const verticalChange = Math.abs(eyeCenter.y - lastGazePosition.y);
        const horizontalChange = Math.abs(eyeCenter.x - lastGazePosition.x);

        // Viewport-based thresholds for gaze detection
        const verticalThreshold = viewportHeight * 0.02; // 2% of viewport height - more sensitive
        const horizontalThreshold = viewportWidth * 0.02; // 2% of viewport width - more sensitive

        // Detect significant gaze movement (looking up/down or left/right)
        gazeMoved = verticalChange > verticalThreshold || horizontalChange > horizontalThreshold;
    }

    // Update last eye position
    lastEyePosition = eyeCenter;

    // Update gaze position for movement detection (only when not blinking)
    if (!isBlinking) {
        lastGazePosition = eyeCenter;
    }

    // Update last EAR values
    lastLeftEAR = leftEAR;
    lastRightEAR = rightEAR;

    // Detect eyes closed for more than 2 seconds (not blinking)
    const now = Date.now();

    if (!eyesOpen && !isBlinking) {
        if (eyesClosedStartTime === null) {
            eyesClosedStartTime = now;
        } else {
            const closedDuration = now - eyesClosedStartTime;
            if (closedDuration > 2000) { // 2 second threshold for sustained closure
                isEyesClosed = true;
            }
        }
    } else {
        // Eyes are open or blinking, reset the timer
        eyesClosedStartTime = null;
        isEyesClosed = false;
    }

    // Eyes are looking at camera if they're open, not moving, and not closed for too long
    // Don't trigger movement detection until we have enough data
    const isLookingAtCamera = eyesOpen && !isEyesClosed && (blinkBuffer.length < 3 || (!eyesMoved && !gazeMoved));

    return {
        lookingAtCamera: isLookingAtCamera,
        leftEyeZ: leftEAR,
        rightEyeZ: rightEAR,
        leftEAR: leftEAR,
        rightEAR: rightEAR,
        eyesMoved: eyesMoved,
        movementX: leftEARChange,
        movementY: rightEARChange,
        eyesClosed: isEyesClosed,
        isBlinking: isBlinking,
        consecutiveClosedFrames: consecutiveClosedFrames,
        gazeMoved: gazeMoved,
        eyePosition: eyeCenter
    };
}

async function initializeFaceMesh() {
    // Get the video element
    video = document.getElementById('video');
    if (!video) {
        throw new Error('Video element not found');
    }

    // Initialize FaceMesh
    faceMesh = new FaceMesh({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
    });

    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    faceMesh.onResults(onFaceMeshResults);

    // Initialize camera
    camera = new Camera(video, {
        onFrame: async () => {
            if (isMonitoring) {
                await faceMesh.send({ image: video });
            }
        },
        width: 640,
        height: 480
    });

    await camera.start();
}

function onFaceMeshResults(results) {
    if (!isMonitoring || !gazeDetectionEnabled) return;

    // Pause tracking when GIF is showing - don't process any face detection events
    if (isGifShowing) return;

    // Ignore events during cooldown period after GIF hides (but allow focus detection)
    const now = Date.now();
    if (now < gifCooldownEndTime) return;

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        const eyeResult = detectEyeGaze(landmarks);

        // Mark face as detected on first successful gaze data
        if (!isFaceDetected) {
            console.log('🎉 First face detection successful!');
            isFaceDetected = true;
            console.log('📝 Updating loading status: Face detection active!');
            updateLoadingStatus('Face detection active!');
        }

        // Update debug info
        updateDebugInfo(true, eyeResult.lookingAtCamera, eyeResult.leftEAR, eyeResult.rightEAR, eyeResult.eyesMoved, eyeResult.movementX, eyeResult.movementY, eyeResult.eyesClosed, eyeResult.isBlinking, eyeResult.consecutiveClosedFrames, eyeResult.gazeMoved, eyeResult.eyePosition);

        // Process gaze movement for focus detection
        if (eyeResult.eyePosition) {
            detectGazeMovement(eyeResult.eyePosition);
        }

        if (eyeResult.gazeMoved && isCurrentlyFocused) {
            isCurrentlyFocused = false;
            lastLookAwayTime = now;
            distractionCount++;
            updateCurrentStreak();

            // Only show GIF if not already showing one
            if (!isGifShowing) {
                showDisappointmentGif();
            }
        }
    } else {
        // Update debug info for no face
        updateDebugInfo(false, false, 0, 0, false, 0, 0, false, false, 0, false, null);

        // No face detected - pause timer immediately
        if (isCurrentlyFocused) {
            isCurrentlyFocused = false;
            lastLookAwayTime = now;
            distractionCount++;
            updateCurrentStreak();

            // Only show GIF if not already showing one
            if (!isGifShowing) {
                showDisappointmentGif();
            }
        }
    }
}

function getEyeCenter(landmarks, eyeIndices) {
    let x = 0, y = 0, z = 0;
    eyeIndices.forEach(index => {
        x += landmarks[index].x;
        y += landmarks[index].y;
        z += landmarks[index].z;
    });
    return {
        x: x / eyeIndices.length,
        y: y / eyeIndices.length,
        z: z / eyeIndices.length
    };
}

function calculateEyeAspectRatio(landmarks, eyeIndices) {
    // Calculate Eye Aspect Ratio (EAR) using specific eye landmarks
    // For MediaPipe Face Mesh, use these specific indices for better accuracy

    if (eyeIndices.length < 6) return 0;

    // Use specific eye landmark indices for more accurate EAR calculation
    const p1 = landmarks[eyeIndices[0]];  // Inner corner
    const p2 = landmarks[eyeIndices[1]];  // Top eyelid
    const p3 = landmarks[eyeIndices[2]];  // Top eyelid
    const p4 = landmarks[eyeIndices[3]];  // Outer corner
    const p5 = landmarks[eyeIndices[4]];  // Bottom eyelid
    const p6 = landmarks[eyeIndices[5]];  // Bottom eyelid

    // Calculate distances
    const vertical1 = Math.sqrt(Math.pow(p2.x - p6.x, 2) + Math.pow(p2.y - p6.y, 2));
    const vertical2 = Math.sqrt(Math.pow(p3.x - p5.x, 2) + Math.pow(p3.y - p5.y, 2));
    const horizontal = Math.sqrt(Math.pow(p1.x - p4.x, 2) + Math.pow(p1.y - p4.y, 2));

    // Avoid division by zero
    if (horizontal === 0) return 0;

    return (vertical1 + vertical2) / (2 * horizontal);
}

function updateDebugInfo(faceDetected, lookingAtCamera, leftEAR, rightEAR, eyesMoved, movementX, movementY, eyesClosed, isBlinking, consecutiveClosedFrames, gazeMoved, eyePosition) {
    if (document.getElementById('faceDetected')) {
        document.getElementById('faceDetected').textContent = faceDetected ? 'Yes' : 'No';
    }
    if (document.getElementById('lookingAtCamera')) {
        document.getElementById('lookingAtCamera').textContent = lookingAtCamera ? 'Yes' : 'No';
    }
    if (document.getElementById('eyesMoved')) {
        document.getElementById('eyesMoved').textContent = eyesMoved ? 'Yes' : 'No';
    }
    if (document.getElementById('eyesClosed')) {
        document.getElementById('eyesClosed').textContent = eyesClosed ? 'Yes' : 'No';
    }
    if (document.getElementById('focusStatus')) {
        document.getElementById('focusStatus').textContent = isCurrentlyFocused ? 'Focused' : 'Distracted';
    }
    // Add blink and gaze info to debug
    if (document.getElementById('debugInfo')) {
        const debugInfo = document.getElementById('debugInfo');
        let blinkInfo = debugInfo.querySelector('#blinkInfo');
        if (!blinkInfo) {
            blinkInfo = document.createElement('div');
            blinkInfo.id = 'blinkInfo';
            debugInfo.appendChild(blinkInfo);
        }
        blinkInfo.textContent = `Blinking: ${isBlinking ? 'Yes' : 'No'} (${consecutiveClosedFrames} frames)`;

        let gazeInfo = debugInfo.querySelector('#gazeInfo');
        if (!gazeInfo) {
            gazeInfo = document.createElement('div');
            gazeInfo.id = 'gazeInfo';
            debugInfo.appendChild(gazeInfo);
        }
        const verticalChange = lastGazePosition && eyePosition ? Math.abs(eyePosition.y - lastGazePosition.y) : 0;
        const horizontalChange = lastGazePosition && eyePosition ? Math.abs(eyePosition.x - lastGazePosition.x) : 0;
        const closedTime = eyesClosedStartTime ? (Date.now() - eyesClosedStartTime) / 1000 : 0;
        gazeInfo.textContent = `Gaze Moved: ${gazeMoved ? 'Yes' : 'No'} (V: ${verticalChange.toFixed(4)}, H: ${horizontalChange.toFixed(4)}) | Closed: ${closedTime.toFixed(1)}s`;
    }
}

function updateTimer() {
    if (!isMonitoring) return;

    const now = Date.now();
    if (isCurrentlyFocused && startTime) {
        // Calculate focus time from restart point
        focusTime = Math.floor((now - startTime) / 1000);
        currentStreak = Math.floor((now - currentStreakStart) / 1000);

        document.getElementById('focusDot').textContent = formatTime(currentStreak);
    } else if (!isCurrentlyFocused) {
        // When not focused, don't update the timer
        // Keep the last focus time and streak
        document.getElementById('focusDot').textContent = formatTime(currentStreak);
    }
}

function updateCurrentStreak() {
    if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
    }
    currentStreak = 0;
}

async function showDisappointmentGif() {
    // Don't show GIF during loading phase
    if (!isFullyLoaded) {
        return;
    }

    // Don't show GIF if one is already showing
    if (isGifShowing) {
        return;
    }

    const gifElement = document.getElementById('backgroundGif');
    const randomGif = await getRandomDisappointedGif();

    gifElement.src = randomGif;
    gifElement.style.display = 'block';
    gifElement.classList.add('show');
    isGifShowing = true;

    // Show button container
    const buttonContainer = document.getElementById('buttonContainer');
    if (buttonContainer) {
        buttonContainer.style.display = 'flex';
    }
}

function hideDisappointmentGif() {
    const gifElement = document.getElementById('backgroundGif');
    if (gifElement) {
        gifElement.classList.remove('show');
        isGifShowing = false;

        // Hide button container
        const buttonContainer = document.getElementById('buttonContainer');
        if (buttonContainer) {
            buttonContainer.style.display = 'none';
        }

        // Clear auto-hide timeout since we're hiding manually
        if (gifAutoHideTimeout) {
            clearTimeout(gifAutoHideTimeout);
            gifAutoHideTimeout = null;
        }

        // Set cooldown period to prevent rapid successive GIFs
        gifCooldownEndTime = Date.now() + gifCooldownDuration;

        setTimeout(() => {
            gifElement.style.display = 'none';
            gifElement.src = '';
        }, 500);
    }
}

function tryAgain() {
    // Hide GIF and Try Again button
    hideDisappointmentGif();

    // Reset timer and focus state
    isCurrentlyFocused = true;
    startTime = Date.now();
    currentStreakStart = Date.now();
    lastFaceDetected = Date.now();
    focusPausedTime = 0;
    lastLookAwayTime = 0;
    gazeStableTime = 0;
    consecutiveMovementCount = 0; // Reset movement counter

    // Reset gaze tracking variables
    lastGazePosition = null;
    gazeHistory = []; // Clear gaze history
    lastLeftEAR = null;
    lastRightEAR = null;
    lastEyePosition = null;

    // Reset eye state variables
    eyesClosedStartTime = null;
    isEyesClosed = false;
    consecutiveClosedFrames = 0;
    isBlinking = false;
    blinkBuffer = [];

    // Set grace period after Try Again to prevent immediate disappointment
    gifCooldownEndTime = Date.now() + 3000; // 3 seconds grace period

    // Ensure gaze detection is enabled
    gazeDetectionEnabled = true;

    // Reset timer display
    document.getElementById('focusDot').textContent = '0:00';
}

function showRegistrationModal() {
    const modal = document.getElementById('registrationModal');
    const finalTimeSpan = document.getElementById('finalTime');
    const currentTime = currentStreak; // Use the same time as displayed on timer

    // Format time as MM:SS
    const minutes = Math.floor(currentTime / 60);
    const seconds = currentTime % 60;
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
    const currentTime = currentStreak; // Use the same time as displayed on timer

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
                time: currentTime
            })
        });

        const result = await response.json();

        if (result.success) {
            // Store the submitted score for highlighting
            localStorage.setItem('highlightScore', JSON.stringify({
                name: name,
                time: currentTime,
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

function closeSession() {
    // Stop monitoring
    stopMonitoring();

    // Redirect to Google
    window.location.href = 'https://www.google.com';
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Ensure GIF is hidden on startup
function ensureGifHidden() {
    const gifElement = document.getElementById('backgroundGif');
    if (gifElement) {
        gifElement.style.display = 'none';
        gifElement.src = '';
        gifElement.classList.remove('show');
        isGifShowing = false;
    }
}

// Pre-load some GIFs when the page loads
window.addEventListener('load', async () => {
    console.log('🌐 Window load event triggered');
    // Ensure GIF is hidden on startup
    console.log('🎬 Ensuring GIF is hidden on startup');
    ensureGifHidden();
    try {
        console.log('📝 Updating loading status: Loading GIFs...');
        updateLoadingStatus('Loading GIFs...');
        console.log('🎬 Fetching disappointed GIFs...');
        await fetchDisappointedGifs();
        console.log('✅ GIFs loaded successfully');
        loadingSteps.gifs = true;
        console.log('📝 Updating loading status: GIFs loaded!');
        updateLoadingStatus('GIFs loaded!');
        console.log('🔍 Checking loading complete after GIFs...');
        checkLoadingComplete();

        console.log('🎯 Starting monitoring...');
        await startMonitoring();
    } catch (error) {
        console.error('❌ Error in window load:', error);
        console.log('📝 Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        console.log('📝 Updating loading status: Failed to load resources. Please refresh and try again.');
        updateLoadingStatus('Failed to load resources. Please refresh and try again.');

        // Show error message to user
        console.log('🚨 Showing error modal for window load failure');
        showErrorModal('Failed to load required resources. Please refresh the page and try again.');
    }
});