// Bike Racing Game - Main Game Logic (FIXED)
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Game Configuration
const CONFIG = {
    canvasWidth: 480,
    canvasHeight: 720,
    roadWidth: 300,
    laneCount: 4,
    playerWidth: 50,
    playerHeight: 90,
    initialSpeed: 5,
    maxSpeed: 20,
    acceleration: 0.02,
    brakeForce: 0.12,
    boostMultiplier: 2.2,
    boostDuration: 4000,
    boostCooldown: 12000,
    spawnInterval: 1800,
    minSpawnInterval: 700,
    coinSpawnChance: 0.2,
    obstacleTypes: ['car', 'truck', 'bus'],
    colors: {
        road: '#1a1a2e',
        roadLine: '#00d4ff',
        grass: '#0f3460',
        grassDetail: '#16537e',
        playerBody: '#00d4ff',
        playerAccent: '#00ffff',
        playerDark: '#006688',
        obstacleCar: '#e94560',
        obstacleTruck: '#8b0000',
        obstacleBus: '#ff6b00',
        coin: '#ffd700',
        coinGlow: '#ffaa00',
        particle: '#00d4ff',
        smoke: '#444',
        exhaust: '#ff6600'
    }
};

// Game State
let gameState = {
    running: false,
    paused: false,
    speed: CONFIG.initialSpeed,
    distance: 0,
    score: 0,
    lives: 3,
    bestScore: parseInt(localStorage.getItem('bikeRacingBestScore')) || 0,
    boostActive: false,
    boostEndTime: 0,
    boostCooldownEnd: 0,
    lastSpawnTime: 0,
    gameTime: 0
};

// Player - position in CANVAS coordinates
const player = {
    x: 0,
    y: 0,
    targetLane: 1,
    currentLane: 1,
    width: CONFIG.playerWidth,
    height: CONFIG.playerHeight,
    lean: 0,
    wheelRotation: 0,
    exhaustParticles: [],
    invincible: false,
    invincibleEnd: 0
};

// Lanes in CANVAS coordinates (center of each lane)
const lanes = [];
const roadLeft = (CONFIG.canvasWidth - CONFIG.roadWidth) / 2;
const laneWidth = CONFIG.roadWidth / CONFIG.laneCount;
for (let i = 0; i < CONFIG.laneCount; i++) {
    lanes.push(roadLeft + laneWidth / 2 + i * laneWidth);
}

// Game Objects
const obstacles = [];
const coins = [];
const particles = [];
const roadLines = [];
const backgroundElements = [];

// Input
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
    ArrowDown: false,
    Space: false,
    KeyP: false,
    Escape: false
};

// DOM Elements
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const pauseScreen = document.getElementById('pause-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const speedDisplay = document.getElementById('speed-display');
const distanceDisplay = document.getElementById('distance-display');
const scoreDisplay = document.getElementById('score-display');
const livesDisplay = document.getElementById('lives-display');
const finalDistance = document.getElementById('final-distance');
const finalScore = document.getElementById('final-score');
const bestScoreEl = document.getElementById('best-score');

// Initialize Canvas
function initCanvas() {
    canvas.width = CONFIG.canvasWidth;
    canvas.height = CONFIG.canvasHeight;

    // Player starts in lane 1 (second from left), near bottom
    player.x = lanes[1];
    player.y = canvas.height - 100;
    player.currentLane = 1;
    player.targetLane = 1;
    player.lean = 0;
    player.wheelRotation = 0;
    player.exhaustParticles.length = 0;
    player.invincible = false;
    player.invincibleEnd = 0;

    // Initialize road lines (moving downward)
    roadLines.length = 0;
    const lineSpacing = 60;
    const lineCount = Math.ceil(CONFIG.canvasHeight / lineSpacing) + 2;
    for (let i = 0; i < lineCount; i++) {
        roadLines.push({
            y: i * lineSpacing - lineSpacing,
            speed: CONFIG.initialSpeed
        });
    }

    // Initialize background elements
    backgroundElements.length = 0;
    for (let i = 0; i < 20; i++) {
        backgroundElements.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 3 + 1,
            speed: Math.random() * 0.5 + 0.2,
            type: Math.random() < 0.5 ? 'star' : 'light'
        });
    }
}

// Start Game
function startGame() {
    gameState = {
        running: true,
        paused: false,
        speed: CONFIG.initialSpeed,
        distance: 0,
        score: 0,
        lives: 3,
        bestScore: gameState.bestScore,
        boostActive: false,
        boostEndTime: 0,
        boostCooldownEnd: 0,
        lastSpawnTime: 0,
        gameTime: 0
    };

    obstacles.length = 0;
    coins.length = 0;
    particles.length = 0;

    initCanvas();

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    updateUI();
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

let lastTime = 0;

// Game Loop
function gameLoop(timestamp) {
    if (!gameState.running) return;

    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    if (!gameState.paused) {
        update(deltaTime);
    }
    render();

    requestAnimationFrame(gameLoop);
}

// Update Game State
function update(deltaTime) {
    const dt = deltaTime / 16.67; // normalize to 60fps
    gameState.gameTime += deltaTime;
    gameState.distance += gameState.speed * dt;

    // Speed increases over time
    if (gameState.speed < CONFIG.maxSpeed) {
        gameState.speed += CONFIG.acceleration * dt;
    }

    // Handle Boost timeout
    if (gameState.boostActive && timestamp > gameState.boostEndTime) {
        gameState.boostActive = false;
    }

    // Handle invincibility
    if (player.invincible && timestamp > player.invincibleEnd) {
        player.invincible = false;
    }

    // Input Handling
    handleInput(dt);

    // Update Player Position
    updatePlayer(dt);

    // Spawn Obstacles & Coins
    spawnObjects(dt);

    // Update Objects
    updateObstacles(dt);
    updateCoins(dt);
    updateParticles(dt);
    updateRoadLines(dt);
    updateBackground(dt);
    updateExhaust(dt);

    // Check Collisions
    checkCollisions();

    // Update Score
    gameState.score = Math.floor(gameState.distance / 5);

    updateUI();
}

// Handle Input
function handleInput(dt) {
    // Steering - tap to change lane (not hold)
    if (keys.ArrowLeft && player.targetLane > 0) {
        player.targetLane--;
        keys.ArrowLeft = false;
    }
    if (keys.ArrowRight && player.targetLane < CONFIG.laneCount - 1) {
        player.targetLane++;
        keys.ArrowRight = false;
    }

    // Acceleration / Brake
    const currentMaxSpeed = gameState.boostActive ? CONFIG.maxSpeed * CONFIG.boostMultiplier : CONFIG.maxSpeed;
    if (keys.ArrowUp && gameState.speed < currentMaxSpeed) {
        gameState.speed += CONFIG.acceleration * 4 * dt;
    }
    if (keys.ArrowDown && gameState.speed > CONFIG.initialSpeed) {
        gameState.speed -= CONFIG.brakeForce * dt;
    }

    // Boost
    if (keys.Space && !gameState.boostActive && timestamp > gameState.boostCooldownEnd) {
        activateBoost();
        keys.Space = false;
    }

    // Pause
    if (keys.KeyP || keys.Escape) {
        togglePause();
        keys.KeyP = false;
        keys.Escape = false;
    }
}

function activateBoost() {
    gameState.boostActive = true;
    gameState.boostEndTime = timestamp + CONFIG.boostDuration;
    gameState.boostCooldownEnd = timestamp + CONFIG.boostCooldown;

    // Boost particles
    for (let i = 0; i < 25; i++) {
        particles.push({
            x: player.x + (Math.random() - 0.5) * player.width,
            y: player.y + player.height / 2,
            vx: (Math.random() - 0.5) * 3,
            vy: Math.random() * 8 + 5,
            life: 1,
            decay: 0.02,
            color: CONFIG.colors.exhaust,
            size: Math.random() * 5 + 3
        });
    }
}

// Update Player - smooth lane transitions
function updatePlayer(dt) {
    const targetX = lanes[player.targetLane];
    const lerpFactor = Math.min(0.2 * dt * 60, 1); // smooth but responsive
    player.x += (targetX - player.x) * lerpFactor;

    // Calculate lean for visual effect
    const laneDiff = player.targetLane - player.currentLane;
    const targetLean = laneDiff * 0.12;
    player.lean += (targetLean - player.lean) * 0.15 * dt * 60;

    // Update current lane when close enough
    if (Math.abs(player.x - targetX) < 3) {
        player.currentLane = player.targetLane;
    }

    // Wheel rotation based on speed
    player.wheelRotation += gameState.speed * 0.15 * dt;

    // Exhaust particles
    const spawnRate = 0.25 * (gameState.speed / CONFIG.maxSpeed);
    if (Math.random() < spawnRate * dt) {
        player.exhaustParticles.push({
            x: player.x + (Math.random() - 0.5) * 18,
            y: player.y + player.height / 2 + 5,
            vx: (Math.random() - 0.5) * 0.8,
            vy: Math.random() * 1.5 + 0.5,
            life: 1,
            decay: 0.025,
            color: gameState.boostActive ? CONFIG.colors.exhaust : CONFIG.colors.smoke,
            size: Math.random() * 3 + 1
        });
    }
}

// Spawn Objects
function spawnObjects(dt) {
    gameState.lastSpawnTime += dt * 16.67;

    const currentSpawnInterval = Math.max(
        CONFIG.minSpawnInterval,
        CONFIG.spawnInterval - gameState.gameTime * 0.04
    );

    if (gameState.lastSpawnTime >= currentSpawnInterval) {
        gameState.lastSpawnTime = 0;

        // Spawn obstacle
        const lane = Math.floor(Math.random() * CONFIG.laneCount);
        const type = CONFIG.obstacleTypes[Math.floor(Math.random() * CONFIG.obstacleTypes.length)];

        obstacles.push({
            x: lanes[lane],
            y: -120,
            lane: lane,
            type: type,
            width: getObstacleWidth(type),
            height: getObstacleHeight(type),
            color: getObstacleColor(type),
            passed: false
        });

        // Sometimes spawn coin in a different lane
        if (Math.random() < CONFIG.coinSpawnChance) {
            let coinLane;
            do {
                coinLane = Math.floor(Math.random() * CONFIG.laneCount);
            } while (coinLane === lane && CONFIG.laneCount > 1);

            coins.push({
                x: lanes[coinLane],
                y: -100,
                lane: coinLane,
                rotation: 0,
                collected: false,
                bounce: 0
            });
        }
    }
}

// Obstacle Dimensions
function getObstacleWidth(type) {
    switch (type) {
        case 'car': return 58;
        case 'truck': return 72;
        case 'bus': return 78;
        default: return 58;
    }
}

function getObstacleHeight(type) {
    switch (type) {
        case 'car': return 100;
        case 'truck': return 120;
        case 'bus': return 130;
        default: return 100;
    }
}

function getObstacleColor(type) {
    switch (type) {
        case 'car': return CONFIG.colors.obstacleCar;
        case 'truck': return CONFIG.colors.obstacleTruck;
        case 'bus': return CONFIG.colors.obstacleBus;
        default: return CONFIG.colors.obstacleCar;
    }
}

// Update Obstacles
function updateObstacles(dt) {
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.y += gameState.speed * dt;

        // Score for passing obstacle
        if (!obs.passed && obs.y > player.y) {
            obs.passed = true;
            gameState.score += 15;
        }

        // Remove off-screen obstacles
        if (obs.y > canvas.height + 150) {
            obstacles.splice(i, 1);
        }
    }
}

// Update Coins
function updateCoins(dt) {
    for (let i = coins.length - 1; i >= 0; i--) {
        const coin = coins[i];
        coin.y += gameState.speed * dt;
        coin.rotation += 0.08 * dt;
        coin.bounce += 0.12 * dt;

        if (coin.y > canvas.height + 80) {
            coins.splice(i, 1);
        }
    }
}

// Update Particles
function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.15 * dt; // gravity
        p.life -= p.decay * dt;

        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

// Update Exhaust
function updateExhaust(dt) {
    for (let i = player.exhaustParticles.length - 1; i >= 0; i--) {
        const p = player.exhaustParticles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.08 * dt;
        p.life -= p.decay * dt;
        p.size *= 1.015;

        if (p.life <= 0) {
            player.exhaustParticles.splice(i, 1);
        }
    }
}

// Update Road Lines
function updateRoadLines(dt) {
    for (const line of roadLines) {
        line.y += gameState.speed * dt;
        if (line.y > canvas.height + 60) {
            line.y = -60;
        }
    }
}

// Update Background
function updateBackground(dt) {
    for (const elem of backgroundElements) {
        elem.y += elem.speed * gameState.speed * dt;
        if (elem.y > canvas.height + 20) {
            elem.y = -20;
            elem.x = Math.random() * canvas.width;
        }
    }
}

// Check Collisions
function checkCollisions() {
    if (player.invincible) return;

    const playerLeft = player.x - player.width / 2;
    const playerRight = player.x + player.width / 2;
    const playerTop = player.y - player.height / 2;
    const playerBottom = player.y + player.height / 2;

    // Obstacle collisions - slightly smaller hitbox for fairness
    const hitboxPadding = 6;
    for (const obs of obstacles) {
        const obsLeft = obs.x - obs.width / 2 + hitboxPadding;
        const obsRight = obs.x + obs.width / 2 - hitboxPadding;
        const obsTop = obs.y - obs.height / 2 + hitboxPadding;
        const obsBottom = obs.y + obs.height / 2 - hitboxPadding;

        if (playerRight > obsLeft && playerLeft < obsRight &&
            playerBottom > obsTop && playerTop < obsBottom) {
            handleCrash();
            return;
        }
    }

    // Coin collisions
    for (const coin of coins) {
        if (coin.collected) continue;

        const dx = player.x - coin.x;
        const dy = player.y - coin.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 45) {
            coin.collected = true;
            collectCoin(coin);
        }
    }
}

function handleCrash() {
    gameState.lives--;

    // Crash particles
    for (let i = 0; i < 35; i++) {
        particles.push({
            x: player.x + (Math.random() - 0.5) * player.width,
            y: player.y + (Math.random() - 0.5) * player.height,
            vx: (Math.random() - 0.5) * 12,
            vy: (Math.random() - 0.5) * 12 - 6,
            life: 1,
            decay: 0.018,
            color: CONFIG.colors.particle,
            size: Math.random() * 7 + 4
        });
    }

    // Screen shake
    canvas.style.animation = 'shake 0.4s ease-out';
    setTimeout(() => canvas.style.animation = '', 400);

    if (gameState.lives <= 0) {
        gameOver();
    } else {
        // Brief invincibility
        player.invincible = true;
        player.invincibleEnd = timestamp + 2000;

        // Reset to center lane
        player.targetLane = 1;

        // Clear nearby obstacles
        for (let i = obstacles.length - 1; i >= 0; i--) {
            if (obstacles[i].y > player.y - 250) {
                obstacles.splice(i, 1);
            }
        }
    }
}

function collectCoin(coin) {
    gameState.score += 75;

    // Coin particles
    for (let i = 0; i < 18; i++) {
        particles.push({
            x: coin.x,
            y: coin.y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8 - 4,
            life: 1,
            decay: 0.025,
            color: CONFIG.colors.coin,
            size: Math.random() * 5 + 3
        });
    }
}

function gameOver() {
    gameState.running = false;

    if (gameState.score > gameState.bestScore) {
        gameState.bestScore = gameState.score;
        localStorage.setItem('bikeRacingBestScore', gameState.bestScore.toString());
    }

    finalDistance.textContent = Math.floor(gameState.distance);
    finalScore.textContent = gameState.score;
    bestScoreEl.textContent = gameState.bestScore;

    gameOverScreen.classList.remove('hidden');
}

function togglePause() {
    if (!gameState.running) return;
    gameState.paused = !gameState.paused;
    pauseScreen.classList.toggle('hidden', !gameState.paused);
}

// Update UI
function updateUI() {
    speedDisplay.textContent = Math.floor(gameState.speed * 10);
    distanceDisplay.textContent = Math.floor(gameState.distance);
    scoreDisplay.textContent = gameState.score;

    const hearts = '❤️ '.repeat(gameState.lives) + '🖤 '.repeat(3 - gameState.lives);
    livesDisplay.innerHTML = hearts.trim();
}

// ============ RENDER ============
function render() {
    // Clear
    ctx.fillStyle = CONFIG.colors.grass;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw background elements
    drawBackground();

    // Draw road
    drawRoad();

    // Draw road lines
    drawRoadLines();

    // Draw coins
    drawCoins();

    // Draw obstacles
    drawObstacles();

    // Draw exhaust
    drawExhaust();

    // Draw player
    drawPlayer();

    // Draw particles
    drawParticles();

    // Draw boost indicator
    if (gameState.boostActive) {
        drawBoostEffect();
    }

    // Draw invincibility flash
    if (player.invincible) {
        drawInvincibilityEffect();
    }
}

// Draw Background
function drawBackground() {
    for (const elem of backgroundElements) {
        if (elem.type === 'star') {
            const alpha = 0.4 + Math.sin(timestamp * 0.003 + elem.x * 0.01) * 0.3;
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(elem.x, elem.y, elem.size, 0, Math.PI * 2);
            ctx.fill();
        } else {
            const alpha = 0.2 + Math.sin(timestamp * 0.002 + elem.y * 0.01) * 0.15;
            ctx.fillStyle = `rgba(0, 212, 255, ${alpha})`;
            ctx.fillRect(elem.x, elem.y, elem.size * 2, elem.size * 2);
        }
    }
}

// Draw Road
function drawRoad() {
    const roadLeft = (canvas.width - CONFIG.roadWidth) / 2;

    // Road surface gradient
    const gradient = ctx.createLinearGradient(roadLeft, 0, roadLeft + CONFIG.roadWidth, 0);
    gradient.addColorStop(0, '#0d0d1a');
    gradient.addColorStop(0.3, '#1a1a2e');
    gradient.addColorStop(0.5, '#151528');
    gradient.addColorStop(0.7, '#1a1a2e');
    gradient.addColorStop(1, '#0d0d1a');
    ctx.fillStyle = gradient;
    ctx.fillRect(roadLeft, 0, CONFIG.roadWidth, canvas.height);

    // Road edges - glowing
    ctx.strokeStyle = CONFIG.colors.roadLine;
    ctx.lineWidth = 5;
    ctx.shadowColor = CONFIG.colors.roadLine;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(roadLeft, 0);
    ctx.lineTo(roadLeft, canvas.height);
    ctx.moveTo(roadLeft + CONFIG.roadWidth, 0);
    ctx.lineTo(roadLeft + CONFIG.roadWidth, canvas.height);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Lane dividers
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([30, 25]);
    for (let i = 1; i < CONFIG.laneCount; i++) {
        const x = roadLeft + i * laneWidth;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    ctx.setLineDash([]);
}

// Draw Road Lines (center dashes)
function drawRoadLines() {
    ctx.fillStyle = CONFIG.colors.roadLine;
    ctx.shadowColor = CONFIG.colors.roadLine;
    ctx.shadowBlur = 8;

    const centerX = canvas.width / 2;
    for (const line of roadLines) {
        // Center line dashes
        ctx.fillRect(centerX - 2.5, line.y, 5, 40);
    }
    ctx.shadowBlur = 0;
}

// Draw Player Bike
function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.lean);

    // Invincibility flash
    if (player.invincible) {
        const flash = Math.sin(timestamp * 0.02) > 0;
        if (!flash) {
            ctx.globalAlpha = 0.4;
        }
    }

    // Boost glow behind bike
    if (gameState.boostActive) {
        const boostGradient = ctx.createRadialGradient(0, player.height / 2 + 10, 0, 0, player.height / 2 + 10, 50);
        boostGradient.addColorStop(0, 'rgba(255, 120, 0, 0.4)');
        boostGradient.addColorStop(0.5, 'rgba(255, 80, 0, 0.2)');
        boostGradient.addColorStop(1, 'rgba(255, 40, 0, 0)');
        ctx.fillStyle = boostGradient;
        ctx.fillRect(-player.width, player.height / 2 - 10, player.width * 2, 60);
    }

    // ===== WHEELS =====
    drawWheel(-player.width / 2 + 10, player.height / 2 - 8, player.wheelRotation, true);
    drawWheel(player.width / 2 - 10, player.height / 2 - 8, player.wheelRotation, true);
    drawWheel(-player.width / 2 + 10, -player.height / 2 + 8, player.wheelRotation, false);
    drawWheel(player.width / 2 - 10, -player.height / 2 + 8, player.wheelRotation, false);

    // ===== BIKE BODY =====
    // Main chassis
    const bodyGradient = ctx.createLinearGradient(-player.width / 2, 0, player.width / 2, 0);
    bodyGradient.addColorStop(0, CONFIG.colors.playerDark);
    bodyGradient.addColorStop(0.3, CONFIG.colors.playerBody);
    bodyGradient.addColorStop(0.5, CONFIG.colors.playerAccent);
    bodyGradient.addColorStop(0.7, CONFIG.colors.playerBody);
    bodyGradient.addColorStop(1, CONFIG.colors.playerDark);
    ctx.fillStyle = bodyGradient;

    // Lower body (engine area)
    ctx.beginPath();
    ctx.roundRect(-player.width / 2, -15, player.width, 55, 10);
    ctx.fill();

    // Upper body (tank/seat area)
    ctx.fillStyle = CONFIG.colors.playerDark;
    ctx.beginPath();
    ctx.roundRect(-player.width / 2 + 4, -player.height / 2 + 10, player.width - 8, 50, 8);
    ctx.fill();

    // Seat
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.roundRect(-14, -player.height / 2 + 18, 28, 22, 6);
    ctx.fill();

    // Accent stripes
    ctx.strokeStyle = CONFIG.colors.playerAccent;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = CONFIG.colors.playerAccent;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(-player.width / 2 + 6, -player.height / 2 + 15);
    ctx.lineTo(player.width / 2 - 6, -player.height / 2 + 15);
    ctx.moveTo(-player.width / 2 + 6, 35);
    ctx.lineTo(player.width / 2 - 6, 35);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Engine details
    ctx.fillStyle = '#111';
    ctx.fillRect(-18, -10, 36, 20);
    ctx.fillStyle = CONFIG.colors.playerAccent;
    ctx.fillRect(-15, -7, 30, 4);
    ctx.fillRect(-15, 0, 30, 4);
    ctx.fillRect(-15, 7, 30, 4);

    // Headlight
    const lightGradient = ctx.createRadialGradient(0, -player.height / 2 + 8, 0, 0, -player.height / 2 + 8, 20);
    lightGradient.addColorStop(0, 'rgba(255, 255, 220, 1)');
    lightGradient.addColorStop(0.5, 'rgba(255, 240, 200, 0.5)');
    lightGradient.addColorStop(1, 'rgba(255, 220, 180, 0)');
    ctx.fillStyle = lightGradient;
    ctx.beginPath();
    ctx.ellipse(0, -player.height / 2 + 8, 20, 12, 0, -Math.PI, 0);
    ctx.fill();

    // Headlight core
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, -player.height / 2 + 8, 6, 0, Math.PI * 2);
    ctx.fill();

    // ===== RIDER =====
    drawRider();

    ctx.restore();
}

function drawRider() {
    // Body (leaning with bike)
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.roundRect(-13, -player.height / 2 + 8, 26, 35, 6);
    ctx.fill();

    // Armor/chest plate
    const armorGradient = ctx.createLinearGradient(-10, -player.height / 2 + 10, 10, -player.height / 2 + 10);
    armorGradient.addColorStop(0, '#222');
    armorGradient.addColorStop(0.5, '#333');
    armorGradient.addColorStop(1, '#222');
    ctx.fillStyle = armorGradient;
    ctx.beginPath();
    ctx.roundRect(-10, -player.height / 2 + 10, 20, 20, 4);
    ctx.fill();

    // Arms on handlebars
    ctx.fillStyle = '#2a2a3e';
    ctx.fillRect(-20, -player.height / 2 + 18, 10, 16);
    ctx.fillRect(10, -player.height / 2 + 18, 10, 16);

    // Gloves
    ctx.fillStyle = '#000';
    ctx.fillRect(-22, -player.height / 2 + 16, 12, 8);
    ctx.fillRect(10, -player.height / 2 + 16, 12, 8);

    // Helmet
    const helmetGradient = ctx.createLinearGradient(-16, -player.height / 2 - 22, 16, -player.height / 2 - 10);
    helmetGradient.addColorStop(0, '#0a0a1a');
    helmetGradient.addColorStop(0.5, '#151528');
    helmetGradient.addColorStop(1, '#0a0a1a');
    ctx.fillStyle = helmetGradient;
    ctx.beginPath();
    ctx.ellipse(0, -player.height / 2 - 16, 16, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Helmet visor
    const visorGradient = ctx.createLinearGradient(-12, -player.height / 2 - 22, 12, -player.height / 2 - 12);
    visorGradient.addColorStop(0, 'rgba(0, 212, 255, 0.9)');
    visorGradient.addColorStop(0.5, 'rgba(0, 180, 255, 0.6)');
    visorGradient.addColorStop(1, 'rgba(0, 150, 220, 0.3)');
    ctx.fillStyle = visorGradient;
    ctx.beginPath();
    ctx.ellipse(0, -player.height / 2 - 18, 12, 10, 0, 0, Math.PI);
    ctx.fill();

    // Helmet stripe
    ctx.strokeStyle = CONFIG.colors.playerAccent;
    ctx.lineWidth = 2;
    ctx.shadowColor = CONFIG.colors.playerAccent;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(-14, -player.height / 2 - 16);
    ctx.lineTo(14, -player.height / 2 - 16);
    ctx.stroke();
    ctx.shadowBlur = 0;
}

function drawWheel(x, y, rotation, isRear) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    // Tire
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.arc(0, 0, isRear ? 20 : 18, 0, Math.PI * 2);
    ctx.fill();

    // Rim
    const rimGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, isRear ? 14 : 12);
    rimGradient.addColorStop(0, '#444');
    rimGradient.addColorStop(0.5, '#222');
    rimGradient.addColorStop(1, '#111');
    ctx.fillStyle = rimGradient;
    ctx.beginPath();
    ctx.arc(0, 0, isRear ? 14 : 12, 0, Math.PI * 2);
    ctx.fill();

    // Spokes
    ctx.strokeStyle = '#555';
    ctx.lineWidth = isRear ? 2.5 : 2;
    for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 / 5) * i;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 4, Math.sin(angle) * 4);
        ctx.lineTo(Math.cos(angle) * (isRear ? 13 : 11), Math.sin(angle) * (isRear ? 13 : 11));
        ctx.stroke();
    }

    // Brake disc
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(0, 0, isRear ? 7 : 6, 0, Math.PI * 2);
    ctx.fill();

    // Rotor holes
    ctx.fillStyle = '#111';
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 / 6) * i;
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * 3, Math.sin(angle) * 3, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

// Draw Obstacles
function drawObstacles() {
    for (const obs of obstacles) {
        ctx.save();
        ctx.translate(obs.x, obs.y);

        // Vehicle shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(0, obs.height / 2 - 5, obs.width / 2.5, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Vehicle body
        const bodyGradient = ctx.createLinearGradient(-obs.width / 2, 0, obs.width / 2, 0);
        bodyGradient.addColorStop(0, shadeColor(obs.color, -30));
        bodyGradient.addColorStop(0.5, obs.color);
        bodyGradient.addColorStop(1, shadeColor(obs.color, -30));
        ctx.fillStyle = bodyGradient;

        ctx.beginPath();
        ctx.roundRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height, 10);
        ctx.fill();

        // Type-specific details
        if (obs.type === 'car') {
            drawCarDetails(obs.width, obs.height);
        } else if (obs.type === 'truck') {
            drawTruckDetails(obs.width, obs.height);
        } else if (obs.type === 'bus') {
            drawBusDetails(obs.width, obs.height);
        }

        // Wheels
        ctx.fillStyle = '#0a0a0a';
        const wheelY = -obs.height / 2 + 12;
        const wheelY2 = obs.height / 2 - 12;
        const wheelX = obs.width / 2 - 14;

        // Front wheels
        drawObstacleWheel(-wheelX, wheelY);
        drawObstacleWheel(wheelX, wheelY);
        // Rear wheels
        drawObstacleWheel(-wheelX, wheelY2);
        drawObstacleWheel(wheelX, wheelY2);

        // Lights
        drawObstacleLights(obs);

        ctx.restore();
    }
}

function drawObstacleWheel(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawObstacleLights(obs) {
    const hw = obs.width / 2;
    const hh = obs.height / 2;

    if (obs.y < player.y) {
        // Vehicle ahead - show taillights (red)
        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 10;
        ctx.fillRect(-hw + 6, hh - 12, 14, 10);
        ctx.fillRect(hw - 20, hh - 12, 14, 10);
        ctx.shadowBlur = 0;
    } else {
        // Vehicle behind - show headlights (white/yellow)
        const lightGrad = ctx.createRadialGradient(-hw + 12, -hh + 8, 0, -hw + 12, -hh + 8, 20);
        lightGrad.addColorStop(0, 'rgba(255, 255, 220, 1)');
        lightGrad.addColorStop(1, 'rgba(255, 255, 220, 0)');
        ctx.fillStyle = lightGrad;
        ctx.fillRect(-hw + 6, -hh + 2, 16, 10);
        ctx.fillRect(hw - 22, -hh + 2, 16, 10);
    }
}

function drawCarDetails(width, height) {
    // Windows
    ctx.fillStyle = 'rgba(80, 180, 255, 0.7)';
    ctx.beginPath();
    ctx.roundRect(-width / 2 + 10, -height / 2 + 18, width - 20, 32, 5);
    ctx.fill();

    // Window frame
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-width / 2 + 10, -height / 2 + 18, width - 20, 32);

    // Roof highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(-width / 2 + 8, -height / 2 + 2, width - 16, 12);
}

function drawTruckDetails(width, height) {
    // Cab windows
    ctx.fillStyle = 'rgba(80, 180, 255, 0.7)';
    ctx.beginPath();
    ctx.roundRect(-width / 2 + 8, -height / 2 + 15, width - 16, 28, 4);
    ctx.fill();

    // Cargo area separators
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
        const y = -height / 2 + 50 + i * 22;
        ctx.beginPath();
        ctx.moveTo(-width / 2 + 12, y);
        ctx.lineTo(width / 2 - 12, y);
        ctx.stroke();
    }

    // Cab roof
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(-width / 2 + 6, -height / 2 + 2, width - 12, 10);
}

function drawBusDetails(width, height) {
    // Window rows
    ctx.fillStyle = 'rgba(80, 180, 255, 0.7)';
    const windowWidth = 20;
    const windowGap = 8;
    const startX = -width / 2 + 12;
    for (let i = 0; i < 5; i++) {
        ctx.fillRect(startX + i * (windowWidth + windowGap), -height / 2 + 20, windowWidth, 28);
    }

    // Door
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-width / 2 + 8, -height / 2 + 15, 35, height - 30);

    // Roof line
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(-width / 2 + 6, -height / 2 + 2, width - 12, 12);
}

// Draw Coins
function drawCoins() {
    for (const coin of coins) {
        if (coin.collected) continue;

        ctx.save();
        const bounceY = Math.sin(coin.bounce) * 6;
        ctx.translate(coin.x, coin.y + bounceY);
        ctx.rotate(coin.rotation);

        // Glow
        const glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 25);
        glowGrad.addColorStop(0, 'rgba(255, 215, 0, 0.5)');
        glowGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(-25, -25, 50, 50);

        // Coin body
        const coinGrad = ctx.createLinearGradient(-18, -18, 18, 18);
        coinGrad.addColorStop(0, '#fff8a0');
        coinGrad.addColorStop(0.3, CONFIG.colors.coin);
        coinGrad.addColorStop(0.7, '#e6c200');
        coinGrad.addColorStop(1, '#b89600');
        ctx.fillStyle = coinGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();

        // Inner ridge
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.stroke();

        // $ symbol
        ctx.fillStyle = '#a67c00';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', 0, 1);

        ctx.restore();
    }
}

// Draw Exhaust
function drawExhaust() {
    for (const p of player.exhaustParticles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// Draw Particles
function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// Draw Boost Effect
function drawBoostEffect() {
    // Speed lines
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
        const x = (timestamp * 0.3 + i * 40) % canvas.width;
        const y = (timestamp * 0.5 + i * 60) % canvas.height;
        const length = 60 + Math.random() * 80;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + length);
        ctx.stroke();
    }

    // Boost text
    const alpha = 0.6 + Math.sin(timestamp * 0.015) * 0.3;
    ctx.fillStyle = `rgba(0, 212, 255, ${alpha})`;
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#00d4ff';
    ctx.shadowBlur = 25;
    ctx.fillText('⚡ BOOST ⚡', canvas.width / 2, 90);
    ctx.shadowBlur = 0;
}

// Draw Invincibility Effect
function drawInvincibilityEffect() {
    ctx.strokeStyle = `rgba(0, 212, 255, ${0.5 + Math.sin(timestamp * 0.02) * 0.3})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00d4ff';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.width / 2 + 15 + Math.sin(timestamp * 0.01) * 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
}

// Helper: shade color
function shadeColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

// ============ EVENT LISTENERS ============
document.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.code)) {
        keys[e.code] = true;
        e.preventDefault();
    }
});

document.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.code)) {
        keys[e.code] = false;
    }
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Touch controls for mobile
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

canvas.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
}, { passive: true });

canvas.addEventListener('touchmove', (e) => {
    if (!gameState.running || gameState.paused) return;

    const diffX = e.touches[0].clientX - touchStartX;
    const diffY = e.touches[0].clientY - touchStartY;

    // Horizontal swipe - change lane
    if (Math.abs(diffX) > 25 && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX < 0 && player.targetLane > 0) {
            player.targetLane--;
        } else if (diffX > 0 && player.targetLane < CONFIG.laneCount - 1) {
            player.targetLane++;
        }
        touchStartX = e.touches[0].clientX;
    }

    // Vertical swipe up - boost
    if (diffY < -40 && !gameState.boostActive && timestamp > gameState.boostCooldownEnd) {
        activateBoost();
        touchStartY = e.touches[0].clientY;
    }
}, { passive: true });

canvas.addEventListener('touchend', (e) => {
    // Tap to boost (if not a swipe)
    const touchDuration = Date.now() - touchStartTime;
    const diffX = Math.abs(e.changedTouches[0].clientX - touchStartX);
    const diffY = Math.abs(e.changedTouches[0].clientY - touchStartY);

    if (touchDuration < 200 && diffX < 15 && diffY < 15) {
        if (!gameState.boostActive && timestamp > gameState.boostCooldownEnd) {
            activateBoost();
        }
    }
}, { passive: true });

// Initialize
initCanvas();
updateUI();
bestScoreEl.textContent = gameState.bestScore;

// Add shake animation
const style = document.createElement('style');
style.textContent = `
@keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-6px) rotate(-1deg); }
    40% { transform: translateX(6px) rotate(1deg); }
    60% { transform: translateX(-4px) rotate(-0.5deg); }
    80% { transform: translateX(4px) rotate(0.5deg); }
}
`;
document.head.appendChild(style);

// Polyfill for roundRect if not supported
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        const radius = r || 5;
        this.beginPath();
        this.moveTo(x + radius, y);
        this.lineTo(x + w - radius, y);
        this.quadraticCurveTo(x + w, y, x + w, y + radius);
        this.lineTo(x + w, y + h - radius);
        this.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        this.lineTo(x + radius, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - radius);
        this.lineTo(x, y + radius);
        this.quadraticCurveTo(x, y, x + radius, y);
        this.closePath();
    };
}