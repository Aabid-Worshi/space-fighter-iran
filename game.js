// Wrap execution entirely inside verification loop to completely avoid null errors
function setupGameEngine() {
    const canvas = document.getElementById("gameCanvas");
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    const scoreEl = document.getElementById("score");
    const livesEl = document.getElementById("lives");
    const gameOverScreen = document.getElementById("game-over-screen");
    const startScreen = document.getElementById("start-screen");
    const startBtn = document.getElementById("startBtn");
    const restartBtn = document.getElementById("restartBtn");

    // Game Variables
    let score = 0;
    const maxLives = 5;
    let lives = maxLives;
    let isGameOver = false;
    let gameActive = false;
    let animationFrameId = null;
    let audioCtx = null;

    const player = {
        x: canvas.width / 2 - 25,
        y: canvas.height - 160,
        width: 50,
        height: 55,
        speed: 6.5
    };

    let keys = { ArrowLeft: false, ArrowRight: false };
    let lasers = [];
    let enemies = [];
    let lastShotTime = 0;
    const shootCooldown = 190; 
    const nations = ["USA", "Israel", "France", "Germany", "Britain"];
    let enemySpawnTimeout = null;

    // Keyboard Event Handling
    document.addEventListener("keydown", (e) => {
        if(e.code === "ArrowLeft" || e.code === "KeyA") keys["ArrowLeft"] = true;
        if(e.code === "ArrowRight" || e.code === "KeyD") keys["ArrowRight"] = true;
    });
    document.addEventListener("keyup", (e) => {
        if(e.code === "ArrowLeft" || e.code === "KeyA") keys["ArrowLeft"] = false;
        if(e.code === "ArrowRight" || e.code === "KeyD") keys["ArrowRight"] = false;
    });

    // Audio Unlocking System
    function triggerAudioUnlock() {
        if (!audioCtx) {
            const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
            if (AudioCtxClass) audioCtx = new AudioCtxClass();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    // Input Listeners Verification Bindings
    if (startBtn) {
        startBtn.onclick = (e) => {
            if (e) e.preventDefault();
            triggerAudioUnlock();
            if (startScreen) startScreen.style.display = "none";
            gameActive = true;
            resetGameEngine();
        };
    }

    if (restartBtn) {
        restartBtn.onclick = (e) => {
            if (e) e.preventDefault();
            triggerAudioUnlock();
            resetGameEngine();
        };
    }

    const leftBtn = document.getElementById("leftBtn");
    const rightBtn = document.getElementById("rightBtn");

    if (leftBtn && rightBtn) {
        leftBtn.addEventListener("touchstart", (e) => { e.preventDefault(); keys["ArrowLeft"] = true; triggerAudioUnlock(); });
        leftBtn.addEventListener("touchend", (e) => { e.preventDefault(); keys["ArrowLeft"] = false; });
        rightBtn.addEventListener("touchstart", (e) => { e.preventDefault(); keys["ArrowRight"] = true; triggerAudioUnlock(); });
        rightBtn.addEventListener("touchend", (e) => { e.preventDefault(); keys["ArrowRight"] = false; });

        leftBtn.addEventListener("mousedown", (e) => { e.preventDefault(); keys["ArrowLeft"] = true; triggerAudioUnlock(); });
        leftBtn.addEventListener("mouseup", () => keys["ArrowLeft"] = false);
        leftBtn.addEventListener("mouseleave", () => keys["ArrowLeft"] = false);
        rightBtn.addEventListener("mousedown", (e) => { e.preventDefault(); keys["ArrowRight"] = true; triggerAudioUnlock(); });
        rightBtn.addEventListener("mouseup", () => keys["ArrowRight"] = false);
        rightBtn.addEventListener("mouseleave", () => keys["ArrowRight"] = false);
    }

    function playLaserSound() {
        if (!audioCtx) return;
        try {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'sawtooth';
            const now = audioCtx.currentTime;
            osc.frequency.setValueAtTime(850, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.14);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
            osc.start(now);
            osc.stop(now + 0.14);
        } catch (err) { console.log(err); }
    }

    function spawnEnemyShip() {
        if (isGameOver || !gameActive) return;
        const size = 44;
        const randomNation = nations[Math.floor(Math.random() * nations.length)];
        enemies.push({
            x: Math.random() * (canvas.width - size),
            y: -size,
            width: size,
            height: size,
            speed: Math.random() * (2.3 - 1.4) + 1.4,
            nation: randomNation
        });
        enemySpawnTimeout = setTimeout(spawnEnemyShip, Math.max(450, 1500 - (score * 35)));
    }

    function resetGameEngine() {
        score = 0;
        lives = maxLives;
        isGameOver = false;
        if (scoreEl) scoreEl.innerText = score;
        if (livesEl) livesEl.innerText = lives;
        if (gameOverScreen) gameOverScreen.style.display = "none";
        lasers = [];
        enemies = [];
        player.x = canvas.width / 2 - player.width / 2;
        player.y = canvas.height - 160;

        clearTimeout(enemySpawnTimeout);
        if (animationFrameId) cancelAnimationFrame(animationFrameId);

        spawnEnemyShip();
        updateEngine();
    }

    function checkCollision(r1, r2) {
        return r1.x < r2.x + r2.width && r1.x + r1.width > r2.x &&
               r1.y < r2.y + r2.height && r1.y + r1.height > r2.y;
    }

    function drawEnemyJet(x, y, w, h, nation) {
        ctx.save();
        ctx.fillStyle = "rgba(255, 80, 0, 0.85)";
        ctx.fillRect(x + w * 0.4, y - 5, w * 0.08, 5);
        ctx.fillRect(x + w * 0.52, y - 5, w * 0.08, 5);

        if (nation === "USA") {
            ctx.fillStyle = "#0a2240"; drawJetBodyShape(x, y, w, h);
            ctx.fillStyle = "#b22234";
            ctx.fillRect(x, y + h * 0.3, w * 0.15, h * 0.1); ctx.fillRect(x + w * 0.85, y + h * 0.3, w * 0.15, h * 0.1);
        } else if (nation === "Israel") {
            ctx.fillStyle = "#ffffff"; drawJetBodyShape(x, y, w, h);
            ctx.fillStyle = "#0038a8"; ctx.fillRect(x + w * 0.43, y + h * 0.1, w * 0.14, h * 0.6);
        } else if (nation === "France") {
            let grad = ctx.createLinearGradient(x, y, x + w, y);
            grad.addColorStop(0, "#002395"); grad.addColorStop(0.5, "#ffffff"); grad.addColorStop(1, "#ed2939");
            ctx.fillStyle = grad; drawJetBodyShape(x, y, w, h);
        } else if (nation === "Germany") {
            let grad = ctx.createLinearGradient(x, y, x, y + h);
            grad.addColorStop(0, "#000000"); grad.addColorStop(0.5, "#dd0000"); grad.addColorStop(1, "#ffce00");
            ctx.fillStyle = grad; drawJetBodyShape(x, y, w, h);
        } else if (nation === "Britain") {
            ctx.fillStyle = "#012169"; drawJetBodyShape(x, y, w, h);
            ctx.fillStyle = "#c8102e";
            ctx.fillRect(x + w * 0.45, y, w * 0.1, h * 0.85); ctx.fillRect(x, y + h * 0.35, w, h * 0.08);
        }
        ctx.restore();
    }

    function drawJetBodyShape(x, y, w, h) {
        ctx.beginPath();
        ctx.moveTo(x + w * 0.5, y + h);
        ctx.lineTo(x + w * 0.1, y + h * 0.6); ctx.lineTo(x, y + h * 0.35);
        ctx.lineTo(x + w * 0.3, y + h * 0.1); ctx.lineTo(x + w * 0.4, y);
        ctx.lineTo(x + w * 0.6, y); ctx.lineTo(x + w * 0.7, y + h * 0.1);
        ctx.lineTo(x + w, y + h * 0.35); ctx.lineTo(x + w * 0.9, y + h * 0.6);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.stroke();
        ctx.fillStyle = "rgba(0, 240, 255, 0.5)";
        ctx.beginPath(); ctx.arc(x + w * 0.5, y + h * 0.5, w * 0.09, 0, Math.PI * 2); ctx.fill();
    }

    function drawPlayerJet(x, y, w, h) {
        ctx.save();
        ctx.fillStyle = "rgba(0, 255, 230, 0.9)";
        ctx.fillRect(x + w * 0.35, y + h, w * 0.08, 6); ctx.fillRect(x + w * 0.57, y + h, w * 0.08, 6);

        let iranGrad = ctx.createLinearGradient(x, y, x, y + h);
        iranGrad.addColorStop(0, "#239f40"); iranGrad.addColorStop(0.5, "#ffffff"); iranGrad.addColorStop(1, "#da251d");
        
        ctx.beginPath();
        ctx.moveTo(x + w * 0.5, y);
        ctx.lineTo(x + w * 0.28, y + h * 0.3); ctx.lineTo(x, y + h * 0.75);
        ctx.lineTo(x + w * 0.3, y + h * 0.65); ctx.lineTo(x + w * 0.3, y + h);
        ctx.lineTo(x + w * 0.7, y + h); ctx.lineTo(x + w * 0.7, y + h * 0.65);
        ctx.lineTo(x + w, y + h * 0.75); ctx.lineTo(x + w * 0.7, y + h * 0.3);
        ctx.closePath();

        ctx.fillStyle = iranGrad; ctx.fill();
        ctx.strokeStyle = "#ffffff"; ctx.stroke();

        ctx.fillStyle = "rgba(218, 37, 29, 0.9)";
        ctx.beginPath(); ctx.ellipse(x + w * 0.5, y + h * 0.45, w * 0.07, h * 0.12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    function updateEngine() {
        if (isGameOver || !gameActive) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Movement logic
        if (keys["ArrowLeft"] && player.x > 0) player.x -= player.speed;
        if (keys["ArrowRight"] && player.x < canvas.width - player.width) player.x += player.speed;

        // Auto Firing logic
        const currentTime = Date.now();
        if (currentTime - lastShotTime > shootCooldown) {
            lasers.push({ x: player.x + player.width / 2 - 2, y: player.y, width: 4, height: 16, speed: 9.5 });
            playLaserSound();
            lastShotTime = currentTime;
        }

        drawPlayerJet(player.x, player.y, player.width, player.height);

        // Update Lasers
