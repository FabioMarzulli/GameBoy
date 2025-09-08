const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const captureBtn = document.getElementById('capture');
const uploadInput = document.getElementById('upload');
const saveBtn = document.getElementById('save');
const switchBtn = document.getElementById('switchCamera');

const paletteSel = document.getElementById('palette');
const pixelScale = document.getElementById('pixelScale');
const resolutionSel = document.getElementById('resolution');
const contrastR = document.getElementById('contrast');
const brightnessR = document.getElementById('brightness');
const saturationR = document.getElementById('saturation');
const vignetteChk = document.getElementById('vignette');
const scanChk = document.getElementById('scanlines');
const invertChk = document.getElementById('invert');
const customColor = document.getElementById('customColor');

let currentFacing = "environment";

// 🎥 Avvio fotocamera
function startCamera() {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: currentFacing } })
        .then(stream => { video.srcObject = stream; })
        .catch(err => alert('Errore fotocamera: ' + err));
}
startCamera();

// 🔄 Switch fotocamera
switchBtn.onclick = () => {
    currentFacing = currentFacing === "environment" ? "user" : "environment";
    startCamera();
};

// Stop fotocamera (quando carico da galleria)
function stopCamera() {
    let stream = video.srcObject;
    if (stream) {
        let tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
    }
}

// Palette base
const palettes = {
    grayscale: [
        [0, 0, 0],
        [85, 85, 85],
        [170, 170, 170],
        [255, 255, 255]
    ],
    dmg: [
        [28, 45, 14],
        [59, 93, 35],
        [133, 177, 78],
        [215, 242, 162]
    ],
    pastel: [
        [255, 180, 200],
        [200, 200, 255],
        [180, 255, 220],
        [255, 255, 255]
    ],
    neon: [
        [0, 255, 200],
        [0, 150, 255],
        [150, 0, 255],
        [255, 0, 200]
    ],
    sepia: [
        [38, 20, 5],
        [89, 56, 20],
        [166, 127, 76],
        [242, 225, 179]
    ]
};

// popolo la select
Object.keys(palettes).forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = key;
    paletteSel.appendChild(opt);
});
paletteSel.value = "dmg";

// Bayer matrix per dithering
const bayer = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
];

function applyGameBoyFilter(imgData) {
    const w = imgData.width,
        h = imgData.height,
        d = imgData.data;
    const pal = palettes[paletteSel.value];
    const contrast = parseFloat(contrastR.value);
    const brightness = parseFloat(brightnessR.value);
    const saturation = parseFloat(saturationR.value);
    const custom = customColor.value;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            let r = d[i],
                g = d[i + 1],
                b = d[i + 2];

            // brightness
            r *= brightness;
            g *= brightness;
            b *= brightness;

            // saturation
            const gray = (r + g + b) / 3;
            r = gray + (r - gray) * saturation;
            g = gray + (g - gray) * saturation;
            b = gray + (b - gray) * saturation;

            // contrast
            r = (r - 128) * contrast + 128;
            g = (g - 128) * contrast + 128;
            b = (b - 128) * contrast + 128;

            let lum = 0.299 * r + 0.587 * g + 0.114 * b;
            if (invertChk.checked) lum = 255 - lum;

            const th = (bayer[y % 4][x % 4] + 0.5) * 16;
            let level = Math.floor(lum * 4 / 256 + (th / 256 - 0.5) / 4);
            level = Math.max(0, Math.min(3, level));

            let c = pal[level];
            // se uso colore custom, tutto monocromatico
            if (custom) {
                const rgb = hexToRgb(custom);
                c = [rgb.r * (level / 3), rgb.g * (level / 3), rgb.b * (level / 3)];
            }
            d[i] = c[0];
            d[i + 1] = c[1];
            d[i + 2] = c[2];
        }
    }

    // vignette
    if (vignetteChk.checked) {
        const cx = w / 2,
            cy = h / 2,
            maxR = Math.hypot(cx, cy);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const dist = Math.hypot(x - cx, y - cy) / maxR;
                const fade = Math.max(0.3, 1 - dist * 1.2);
                d[i] *= fade;
                d[i + 1] *= fade;
                d[i + 2] *= fade;
            }
        }
    }

    // scanlines
    if (scanChk.checked) {
        for (let y = 0; y < h; y += 2) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                d[i] *= 0.5;
                d[i + 1] *= 0.5;
                d[i + 2] *= 0.5;
            }
        }
    }
    return imgData;
}

function hexToRgb(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function render(source) {
    const [cw, ch] = resolutionSel.value.split("x").map(Number);
    canvas.width = cw;
    canvas.height = ch;
    ctx.drawImage(source, 0, 0, cw, ch);
    let img = ctx.getImageData(0, 0, cw, ch);
    img = applyGameBoyFilter(img);
    ctx.putImageData(img, 0, 0);
    const ps = parseInt(pixelScale.value);
    canvas.style.width = (cw * ps) + "px";
    canvas.style.height = (ch * ps) + "px";
}

function loop() {
    render(video);
    requestAnimationFrame(loop);
}
video.onplaying = () => loop();

// 📂 Upload immagine
uploadInput.onchange = (e) => {
    stopCamera();
    const file = e.target.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => render(img);
    img.src = URL.createObjectURL(file);
};

// 📷 Scatta
captureBtn.onclick = () => { render(video); };

// 💾 Salva
saveBtn.onclick = () => {
    canvas.toBlob(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'gameboy_photo.png';
        a.click();
    });
};