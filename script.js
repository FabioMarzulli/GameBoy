// DOM Elements
const video = document.getElementById('video');
const liveCanvas = document.getElementById('liveCanvas');
const previewCanvas = document.getElementById('previewCanvas');
const liveCtx = liveCanvas.getContext('2d');
const previewCtx = previewCanvas.getContext('2d');

// Views
const cameraView = document.getElementById('cameraView');
const previewView = document.getElementById('previewView');

// Buttons
const captureBtn = document.getElementById('captureBtn');
const switchBtn = document.getElementById('switchBtn');
const galleryBtn = document.getElementById('galleryBtn');
const uploadInput = document.getElementById('uploadInput');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');

// Settings
const resolutionSel = document.getElementById('resolution');
const pixelScale = document.getElementById('pixelScale');
const contrastR = document.getElementById('contrast');
const brightnessR = document.getElementById('brightness');
const saturationR = document.getElementById('saturation');
const vignetteChk = document.getElementById('vignette');
const scanChk = document.getElementById('scanlines');
const invertChk = document.getElementById('invert');
const noiseChk = document.getElementById('noise');

// Value displays
const pixelValue = document.getElementById('pixelValue');
const contrastValue = document.getElementById('contrastValue');
const brightnessValue = document.getElementById('brightnessValue');
const saturationValue = document.getElementById('saturationValue');

// State
let currentFacing = 'environment';
let currentStream = null;
let animationId = null;
let selectedPalette = 'dmg';
let capturedImageData = null;

// Color Palettes
const palettes = {
    dmg: {
        name: 'Game Boy',
        colors: [
            [15, 56, 15],
            [48, 98, 48],
            [139, 172, 15],
            [155, 188, 15]
        ]
    },
    gray: {
        name: 'Grigio',
        colors: [
            [0, 0, 0],
            [85, 85, 85],
            [170, 170, 170],
            [255, 255, 255]
        ]
    },
    green: {
        name: 'Verde',
        colors: [
            [0, 40, 0],
            [0, 90, 0],
            [0, 150, 0],
            [0, 255, 0]
        ]
    },
    blue: {
        name: 'Blu',
        colors: [
            [0, 0, 40],
            [0, 0, 90],
            [0, 0, 150],
            [0, 0, 255]
        ]
    },
    red: {
        name: 'Rosso',
        colors: [
            [40, 0, 0],
            [90, 0, 0],
            [150, 0, 0],
            [255, 0, 0]
        ]
    },
    purple: {
        name: 'Viola',
        colors: [
            [40, 0, 40],
            [90, 0, 90],
            [150, 0, 150],
            [255, 0, 255]
        ]
    },
    cyan: {
        name: 'Ciano',
        colors: [
            [0, 40, 40],
            [0, 90, 90],
            [0, 150, 150],
            [0, 255, 255]
        ]
    },
    yellow: {
        name: 'Giallo',
        colors: [
            [40, 40, 0],
            [90, 90, 0],
            [150, 150, 0],
            [255, 255, 0]
        ]
    },
    sepia: {
        name: 'Seppia',
        colors: [
            [38, 20, 5],
            [89, 56, 20],
            [166, 127, 76],
            [242, 225, 179]
        ]
    },
    pastel: {
        name: 'Pastello',
        colors: [
            [255, 180, 200],
            [200, 200, 255],
            [180, 255, 220],
            [255, 255, 255]
        ]
    },
    neon: {
        name: 'Neon',
        colors: [
            [0, 255, 200],
            [0, 150, 255],
            [150, 0, 255],
            [255, 0, 200]
        ]
    },
    retro: {
        name: 'Retro',
        colors: [
            [44, 62, 80],
            [52, 152, 219],
            [46, 204, 113],
            [241, 196, 15]
        ]
    }
};

// Bayer Matrix for dithering
const bayerMatrix = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
];

// Initialize palette buttons
function initPaletteButtons() {
    const paletteGrid = document.getElementById('paletteGrid');

    Object.keys(palettes).forEach(key => {
        const btn = document.createElement('button');
        btn.className = 'palette-btn';
        if (key === selectedPalette) btn.classList.add('active');

        const preview = document.createElement('div');
        preview.className = 'palette-preview';

        palettes[key].colors.forEach(color => {
            const div = document.createElement('div');
            div.className = 'palette-color';
            div.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            preview.appendChild(div);
        });

        btn.appendChild(preview);
        btn.title = palettes[key].name;

        btn.onclick = () => {
            document.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedPalette = key;
        };

        paletteGrid.appendChild(btn);
    });
}

// Start camera
async function startCamera() {
    try {
        // Stop previous stream if exists
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }

        const constraints = {
            video: {
                facingMode: currentFacing,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };

        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = currentStream;

        // Start rendering when video is ready
        video.onloadedmetadata = () => {
            video.play();
            startLiveRendering();
        };
    } catch (err) {
        console.error('Camera error:', err);
        alert('Errore nell\'accesso alla fotocamera');
    }
}

// Apply Game Boy filter
function applyGameBoyFilter(imageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const palette = palettes[selectedPalette].colors;

    const contrast = parseFloat(contrastR.value);
    const brightness = parseFloat(brightnessR.value);
    const saturation = parseFloat(saturationR.value);

    // Process each pixel
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;

            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];

            // Apply brightness
            r = Math.min(255, r * brightness);
            g = Math.min(255, g * brightness);
            b = Math.min(255, b * brightness);

            // Apply saturation
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            r = gray + (r - gray) * saturation;
            g = gray + (g - gray) * saturation;
            b = gray + (b - gray) * saturation;

            // Apply contrast
            r = ((r / 255 - 0.5) * contrast + 0.5) * 255;
            g = ((g / 255 - 0.5) * contrast + 0.5) * 255;
            b = ((b / 255 - 0.5) * contrast + 0.5) * 255;

            // Clamp values
            r = Math.max(0, Math.min(255, r));
            g = Math.max(0, Math.min(255, g));
            b = Math.max(0, Math.min(255, b));

            // Calculate luminance
            let lum = 0.299 * r + 0.587 * g + 0.114 * b;

            // Invert if needed
            if (invertChk.checked) {
                lum = 255 - lum;
            }

            // Apply dithering
            const bayerValue = bayerMatrix[y % 4][x % 4];
            const threshold = (bayerValue + 0.5) * 16;

            // Quantize to palette
            let level = Math.floor(lum * palette.length / 256 + (threshold / 256 - 0.5) / palette.length);
            level = Math.max(0, Math.min(palette.length - 1, level));

            const color = palette[level];
            data[i] = color[0];
            data[i + 1] = color[1];
            data[i + 2] = color[2];
        }
    }

    // Apply vignette effect
    if (vignetteChk.checked) {
        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                const vignette = Math.max(0.3, 1 - (distance / maxRadius) * 0.8);

                data[i] *= vignette;
                data[i + 1] *= vignette;
                data[i + 2] *= vignette;
            }
        }
    }

    // Apply scanlines
    if (scanChk.checked) {
        for (let y = 0; y < height; y += 2) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                data[i] *= 0.7;
                data[i + 1] *= 0.7;
                data[i + 2] *= 0.7;
            }
        }
    }

    // Apply noise
    if (noiseChk.checked) {
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * 20;
            data[i] = Math.max(0, Math.min(255, data[i] + noise));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
        }
    }

    return imageData;
}

// Render frame
function renderFrame(source, canvas, ctx) {
    const [width, height] = resolutionSel.value.split('x').map(Number);

    canvas.width = width;
    canvas.height = height;

    // Draw and process
    ctx.drawImage(source, 0, 0, width, height);
    let imageData = ctx.getImageData(0, 0, width, height);
    imageData = applyGameBoyFilter(imageData);
    ctx.putImageData(imageData, 0, 0);

    // Apply pixel scaling for display
    const scale = parseInt(pixelScale.value);
    canvas.style.width = `${width * scale}px`;
    canvas.style.height = `${height * scale}px`;

    return imageData;
}

// Live rendering loop
function startLiveRendering() {
    function loop() {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            renderFrame(video, liveCanvas, liveCtx);
        }
        animationId = requestAnimationFrame(loop);
    }
    loop();
}

// Stop live rendering
function stopLiveRendering() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

// Capture photo
function capturePhoto() {
    capturedImageData = renderFrame(video, previewCanvas, previewCtx);
    showPreview();
}

// Show preview
function showPreview() {
    stopLiveRendering();
    cameraView.classList.remove('active');
    previewView.classList.add('active');
}

// Hide preview
function hidePreview() {
    previewView.classList.remove('active');
    cameraView.classList.add('active');
    startLiveRendering();
}

// Save image
function saveImage() {
    previewCanvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gameboy_photo_${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
    });
    hidePreview();
}

// Load image from file
function loadImageFromFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            stopLiveRendering();
            renderFrame(img, previewCanvas, previewCtx);
            showPreview();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Event Listeners
captureBtn.addEventListener('click', capturePhoto);

switchBtn.addEventListener('click', () => {
    currentFacing = currentFacing === 'environment' ? 'user' : 'environment';
    startCamera();
});

galleryBtn.addEventListener('click', () => {
    uploadInput.click();
});

uploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        loadImageFromFile(file);
    }
});

saveBtn.addEventListener('click', saveImage);
cancelBtn.addEventListener('click', hidePreview);

// Settings listeners
pixelScale.addEventListener('input', (e) => {
    pixelValue.textContent = `${e.target.value}x`;
});

contrastR.addEventListener('input', (e) => {
    contrastValue.textContent = e.target.value;
});

brightnessR.addEventListener('input', (e) => {
    brightnessValue.textContent = e.target.value;
});

saturationR.addEventListener('input', (e) => {
    saturationValue.textContent = e.target.value;
});

// Prevent zoom on double tap
document.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) {
        e.preventDefault();
    }
});

// Initialize
initPaletteButtons();
startCamera();