const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const gameOverScreen = document.getElementById("game-over-screen");
const startScreen = document.getElementById("start-screen");
const startBtn = document.getElementById("startBtn");

// Game States
let score = 0;
let maxLives = 5;
let lives = maxLives;
let isGameOver = false;
let animationFrameId; 
let audioCtx = null; // Global audio engine handle

// Player Setup
const player = {
    x: 175,
    y: 420, 
    width: 50,
    height: 55,
    speed: 6
};

let keys = { ArrowLeft: false, ArrowRight: false };

// Keyboard Controls
document.addEventListener("keydown", (e) => {
    if(e.code === "ArrowLeft" || e.code === "KeyA") keys["ArrowLeft"] = true;
    if(e.code === "ArrowRight" || e.code === "KeyD") keys["ArrowRight"] = true;
});
document.addEventListener("keyup", (e) => {
    if(e.code === "ArrowLeft" || e.code === "KeyA") keys["ArrowLeft"] = false;
    if(e.code === "ArrowRight" || e.code === "KeyD") keys["ArrowRight"] = false;
});

function setupInputListeners() {
    const leftBtn = document.getElementById("leftBtn");
    const rightBtn = document.getElementById("rightBtn");
    const restartBtn = document.getElementById("restartBtn");

    if (restartBtn) restartBtn.onclick = resetGame;

    // START BUTTON: This explicit click unlocks audio context pipelines safely on iOS & Android
    if (startBtn) {
        startBtn.onclick = () => {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                audioCtx = new AudioContextClass();
            }
            startScreen.style.display = "none";
            resetGame();
        };
    }

    if (leftBtn && rightBtn) {
        leftBtn.addEventListener("touchstart", (e) => { e.preventDefault(); keys["ArrowLeft"] = true; });
        leftBtn.addEventListener("touchend", (e) => { e.preventDefault(); keys["ArrowLeft"] = false; });
        rightBtn.addEventListener("touchstart", (e) => { e.preventDefault(); keys["ArrowRight"] = true; });
        rightBtn.addEventListener("touchend", (e) => { e.preventDefault(); keys["ArrowRight"] = false; });

        leftBtn.addEventListener("mousedown", (e) => { e.preventDefault(); keys["ArrowLeft"] = true; });
        leftBtn.addEventListener("mouseup", () => keys["ArrowLeft"] = false);
        leftBtn.addEventListener("mouseleave", () => keys["ArrowLeft"] = false);
        rightBtn.addEventListener("mousedown", (e) => { e.preventDefault(); keys["ArrowRight"] = true; });
        rightBtn.addEventListener("mouseup", () => keys["ArrowRight"] = false);
        rightBtn.addEventListener("mouseleave", () => keys["ArrowRight"] = false);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupInputListeners);
} else {
    setupInputListeners();
}

let lasers = [];
let enemies = [];
let lastShotTime = 0;
const shootCooldown = 200; 
const nations = ["USA", "Israel", "France", "Germany", "Britain"];
let enemySpawnTimeout;

function playLaserSound() {
    if (!audioCtx) return;
    try {
        // Resume audio context pipeline safely if suspended
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.type = 'sawtooth'; 
        
        const now = audioCtx.currentTime;
        oscillator.frequency.setValueAtTime(880, now); 
        oscillator.frequency.exponentialRampToValueAtTime(110, now + 0.15); 
        
        gainNode.gain.setValueAtTime(0.12, now); 
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15); 
        
        oscillator.start(now);
        oscillator.stop(now + 0.15);
    } catch (error) {
        console.log("Audio Error:", error);
    }
}

function spawnEnemy() {
    if (isGameOver) return;
    const size = 45; 
    const randomNation = nations[Math.floor(Math.random() * nations.length)];

    enemies.push({
        x: Math.random() * (canvas.width - size),
        y: -size,
        width: size,
        height: size,
        speed: Math.random() * (2.2 - 1.4) + 1.4,
        nation: randomNation
    });
    
    enemySpawnTimeout = setTimeout(spawnEnemy, Math.max(500, 1500 - (score * 35)));
}

function resetGame() {
    score = 0;
    lives = maxLives;
    isGameOver = false;
    if(scoreEl) scoreEl.innerText = score;
    if(livesEl) livesEl.innerText = lives;
    if(gameOverScreen) gameOverScreen.style.display = "none";
    lasers = [];
    enemies = [];
    player.x = canvas.width / 2 - 25;
    player.y = canvas.height - 160;
    
    clearTimeout(enemySpawnTimeout);
    cancelAnimationFrame(animationFrameId); 
    
    spawnEnemy();
    update();
}

function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

function drawEnemyJet(x, y, w, h, nation) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 90, 0, 0.8)";
    ctx.fillRect(x + w * 0.4, y - 5, w * 0.08, 5);
    ctx.fillRect(x + w * 0.52, y - 5, w * 0.08, 5);

    if (nation === "USA") {
        ctx.fillStyle = "#0a2240";
        drawJetBody(x, y, w, h);
        ctx.fillStyle = "#b22234";
        ctx.fillRect(x, y + h * 0.3, w * 0.15, h * 0.1);
        ctx.fillRect(x + w * 0.85, y + h * 0.3, w * 0.15, h * 0.1);
    } else if (nation === "Israel") {
        ctx.fillStyle = "#ffffff";
        drawJetBody(x, y, w, h);
        ctx.fillStyle = "#0038a8";
        ctx.fillRect(x + w * 0.43, y + h * 0.1, w * 0.14, h * 0.6);
    } else if (nation === "France") {
        let grad = ctx.createLinearGradient(x, y, x + w, y);
        grad.addColorStop(0, "#002395");
        grad.addColorStop(0.5, "#ffffff");
        grad.addColorStop(1, "#ed2939");
        ctx.fillStyle = grad;
        drawJetBody(x, y, w, h);
    } else if (nation === "Germany") {
        let grad = ctx.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, "#000000");
        grad.addColorStop(0.5, "#dd0000");
        grad.addColorStop(1, "#ffce00");
        ctx.fillStyle = grad;
        drawJetBody(x, y, w, h);
    } else if (nation === "Britain") {
        ctx.fillStyle = "#012169";
        drawJetBody(x, y, w, h);
        ctx.fillStyle = "#c8102e";
        ctx.fillRect(x + w * 0.45, y, w * 0.1, h * 0.85);
        ctx.fillRect(x, y + h * 0.35, w, h * 0.08);
    }
    ctx.restore();
}

function drawJetBody(x, y, w, h) {
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5, y + h); 
    ctx.lineTo(x + w * 0.1, y + h * 0.6);
    ctx.lineTo(x, y + h * 0.35); 
    ctx.lineTo(x + w * 0.3, y + h * 0.1);
    ctx.lineTo(x + w * 0.4, y);
    ctx.lineTo(x + w * 0.6, y);
    ctx.lineTo(x + w * 0.7, y + h * 0.1);
    ctx.lineTo(x + w, y + h * 0.35); 
    ctx.lineTo(x + w * 0.9, y + h * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.stroke();

    ctx.fillStyle = "rgba(0, 240, 255, 0.5)";
    ctx.beginPath();
    ctx.arc(x + w * 0.5, y + h * 0.5, w * 0.09, 0, Math.PI * 2);
    ctx.fill();
}

function drawPlayerJet(x, y, w, h) {
    ctx.save();
    ctx.fillStyle = "rgba(0, 255, 230, 0.9)";
    ctx.fillRect(x + w * 0.35, y + h, w * 0.08, 6);
    ctx.fillRect(x + w * 0.57, y + h, w * 0.08, 6);

    let iranGrad = ctx.createLinearGradient(x, y, x, y + h);
    iranGrad.addColorStop(0, "#239f40");   
    iranGrad.addColorStop(0.5, "#ffffff"); 
    iranGrad.addColorStop(1, "#da251d");   
    
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5, y); 
    ctx.lineTo(x + w * 0.28, y + h * 0.3);
    ctx.lineTo(x, y + h * 0.75); 
    ctx.lineTo(x + w * 0.3, y + h * 0.65);
    ctx.lineTo(x + w * 0.3, y + h);
    ctx.lineTo(x + w * 0.7, y + h);
    ctx.lineTo(x + w * 0.7, y + h * 0.65);
    ctx.lineTo(x + w, y + h * 0.75); 
    ctx.lineTo(x + w * 0.7, y + h * 0.3);
    ctx.closePath();

    ctx.fillStyle = iranGrad;
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    ctx.fillStyle = "rgba(218, 37, 29, 0.9)";
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, y + h * 0.45, w * 0.07, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function update() {
    if (isGameOver) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (keys["ArrowLeft"] && player.x > 0) player.x -= player.speed;
    if (keys["ArrowRight"] && player.x < canvas.width - player.width) player.x += player.speed;

    const currentTime = Date.now();
    if (currentTime - lastShotTime > shootCooldown) {
        lasers.push({
            x: player.x + player.width / 2 - 2,
            y: player.y,
            width: 4,
            height: 16,
            speed: 9
        });
        
        playLaserSound(); 
        lastShotTime = currentTime;
    }

    drawPlayerJet(player.x, player.y, player.width, player.height);

    for (let i = lasers.length - 1; i >= 0; i--) {
        lasers[i].y -= lasers[i].speed;
        ctx.fillStyle = "#00ffcc";
        ctx.fillRect(lasers[i].x, lasers[i].y, lasers[i].width, lasers[i].height);
        if (lasers[i].y < 0) lasers.splice(i, 1);
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        enemies[i].y += enemies[i].speed;
        drawEnemyJet(enemies[i].x, enemies[i].y, enemies[i].width, enemies[i].height, enemies[i].nation);

        if (checkCollision(player, enemies[i])) {
            triggerGameOver();
            return;
        }

        if (enemies[i].y > canvas.height) {
            enemies.splice(i, 1);
            lives--;
