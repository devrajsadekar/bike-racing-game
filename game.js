// Bike Racing Game - Main Game Logic
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Game Configuration
const CONFIG = {
    canvasWidth: 480,
    canvasHeight: 720,
    roadWidth: 320,
    laneCount: 4,
    playerWidth: 50,
    playerHeight: 90,
    initialSpeed: 4,
    maxSpeed: 18,
    acceleration: 0.03,
    brakeForce: 0.15,
    boostMultiplier: 2.5,
    boostDuration: 3000,
    boostCooldown: 10000,
    spawnInterval: 1500,
    minSpawnInterval: 600,
    coinSpawnChance: 0.15,
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

// Player
const player = {
    x: 0,
    y: 0,
    targetLane: 1,
    currentLane: 1,
    laneTransition: 0,
    width: CONFIG.playerWidth,
    height: CONFIG.playerHeight,
    lean: 0,
    wheelRotation: 0,
    exhaustParticles: []
};

// Lanes
const lanes = [];
const laneWidth = CONFIG.roadWidth / CONFIG.laneCount;
for (let i = 0; i < CONFIG.laneCount; i++) {
    lanes.push(-CONFIG.roadWidth / 2 + laneWidth / 2 + i * laneWidth);
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
    player.x = canvas.width / 2;
    player.y = canvas.height - 120;
    player.currentLane = 1;
    player.targetLane = 1;

    // Initialize road lines
    roadLines.length = 0;
    for (let i = 0; i < 20; i++) {
        roadLines.push({
            y: i * (CONFIG.canvasHeight / 20) - CONFIG.canvasHeight,
            speed: CONFIG.initialSpeed
        });
    }

    // Initialize background elements
    backgroundElements.length = 0;
    for (let i = 0; i < 15; i++) {
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
    player.exhaustParticles.length = 0;
    player.lean = 0;
    player.wheelRotation = 0;
    player.currentLane = 1;
    player.targetLane = 1;
    player.laneTransition = 0;

    initCanvas();

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    updateUI();
    requestAnimationFrame(gameLoop);
}

// Game Loop
let lastTime = 0;
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
    gameState.gameTime += deltaTime;
    gameState.distance += gameState.speed * (deltaTime / 16.67);

    // Speed increases over time
    if (gameState.speed < CONFIG.maxSpeed) {
        gameState.speed += CONFIG.acceleration * (deltaTime / 16.67);
    }

    // Handle Boost
    if (gameState.boostActive && timestamp > gameState.boostEndTime) {
        gameState.boostActive = false;
    }

    // Input Handling
    handleInput(deltaTime);

    // Update Player Position
    updatePlayer(deltaTime);

    // Spawn Obstacles & Coins
    spawnObjects(deltaTime);

    // Update Objects
    updateObstacles(deltaTime);
    updateCoins(deltaTime);
    updateParticles(deltaTime);
    updateRoadLines(deltaTime);
    updateBackground(deltaTime);
    updateExhaust(deltaTime);

    // Check Collisions
    checkCollisions();

    // Update Score
    gameState.score = Math.floor(gameState.distance / 10) + (gameState.boostActive ? 50 : 0);

    updateUI();
}

// Handle Input
function handleInput(deltaTime) {
    const turnSpeed = 0.15 * (deltaTime / 16.67);

    // Steering
    if (keys.ArrowLeft && player.targetLane > 0) {
        player.targetLane--;
        keys.ArrowLeft = false; // Prevent holding
    }
    if (keys.ArrowRight && player.targetLane < CONFIG.laneCount - 1) {
        player.targetLane++;
        keys.ArrowRight = false;
    }

    // Acceleration / Brake
    const currentMaxSpeed = gameState.boostActive ? CONFIG.maxSpeed * CONFIG.boostMultiplier : CONFIG.maxSpeed;
    if (keys.ArrowUp && gameState.speed < currentMaxSpeed) {
        gameState.speed += CONFIG.acceleration * 3 * (deltaTime / 16.67);
    }
    if (keys.ArrowDown && gameState.speed > CONFIG.initialSpeed) {
        gameState.speed -= CONFIG.brakeForce * (deltaTime / 16.67);
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
    for (let i = 0; i < 20; i++) {
        particles.push({
            x: player.x + (Math.random() - 0.5) * player.width,
            y: player.y + player.height / 2,
            vx: (Math.random() - 0.5) * 2,
            vy: Math.random() * 5 + 3,
            life: 1,
            decay: 0.02,
            color: CONFIG.colors.exhaust,
            size: Math.random() * 4 + 2
        });
    }
}

// Update Player
function updatePlayer(deltaTime) {
    const targetX = lanes[player.targetLane];
    const lerpFactor = 0.15 * (deltaTime / 16.67) * 60;
    player.x += (targetX - player.x) * lerpFactor;

    // Calculate lean for visual effect
    const targetLean = (player.targetLane - player.currentLane) * 0.15;
    player.lean += (targetLean - player.lean) * 0.1;

    // Update current lane when close enough
    if (Math.abs(player.x - targetX) < 2) {
        player.currentLane = player.targetLane;
    }

    // Wheel rotation based on speed
    player.wheelRotation += gameState.speed * 0.1 * (deltaTime / 16.67);

    // Exhaust particles
    if (Math.random() < 0.3 * (gameState.speed / CONFIG.maxSpeed)) {
        player.exhaustParticles.push({
            x: player.x + (Math.random() - 0.5) * 20,
            y: player.y + player.height / 2 + 10,
            vx: (Math.random() - 0.5) * 1,
            vy: Math.random() * 2 + 1,
            life: 1,
            decay: 0.03,
            color: gameState.boostActive ? CONFIG.colors.exhaust : CONFIG.colors.smoke,
            size: Math.random() * 3 + 1
        });
    }
}

// Spawn Objects
function spawnObjects(deltaTime) {
    gameState.lastSpawnTime += deltaTime;

    const currentSpawnInterval = Math.max(
        CONFIG.minSpawnInterval,
        CONFIG.spawnInterval - gameState.gameTime * 0.05
    );

    if (gameState.lastSpawnTime >= currentSpawnInterval) {
        gameState.lastSpawnTime = 0;

        // Spawn obstacle
        const lane = Math.floor(Math.random() * CONFIG.laneCount);
        const type = CONFIG.obstacleTypes[Math.floor(Math.random() * CONFIG.obstacleTypes.length)];

        obstacles.push({
            x: lanes[lane],
            y: -100,
            lane: lane,
            type: type,
            width: getObstacleWidth(type),
            height: getObstacleHeight(type),
            color: getObstacleColor(type),
            passed: false
        });

        // Sometimes spawn coin
        if (Math.random() < CONFIG.coinSpawnChance) {
            const coinLane = Math.floor(Math.random() * CONFIG.laneCount);
            if (coinLane !== lane) { // Don't spawn in same lane as obstacle
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
}

// Obstacle Dimensions
function getObstacleWidth(type) {
    switch (type) {
        case 'car': return 55;
        case 'truck': return 70;
        case 'bus': return 75;
        default: return 55;
    }
}

function getObstacleHeight(type) {
    switch (type) {
        case 'car': return 95;
        case 'truck': return 110;
        case 'bus': return 120;
        default: return 95;
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
function updateObstacles(deltaTime) {
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.y += gameState.speed * (deltaTime / 16.67);

        // Score for passing obstacle
        if (!obs.passed && obs.y > player.y) {
            obs.passed = true;
            gameState.score += 10;
        }

        // Remove off-screen obstacles
        if (obs.y > canvas.height + 100) {
            obstacles.splice(i, 1);
        }
    }
}

// Update Coins
function updateCoins(deltaTime) {
    for (let i = coins.length - 1; i >= 0; i--) {
        const coin = coins[i];
        coin.y += gameState.speed * (deltaTime / 16.67);
        coin.rotation += 0.05 * (deltaTime / 16.67);
        coin.bounce += 0.1 * (deltaTime / 16.67);

        if (coin.y > canvas.height + 50) {
            coins.splice(i, 1);
        }
    }
}

// Update Particles
function updateParticles(deltaTime) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1; // gravity
        p.life -= p.decay;

        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

// Update Exhaust
function updateExhaust(deltaTime) {
    for (let i = player.exhaustParticles.length - 1; i >= 0; i--) {
        const p = player.exhaustParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.life -= p.decay;
        p.size *= 1.02;

        if (p.life <= 0) {
            player.exhaustParticles.splice(i, 1);
        }
    }
}

// Update Road Lines
function updateRoadLines(deltaTime) {
    for (const line of roadLines) {
        line.y += gameState.speed * (deltaTime / 16.67);
        if (line.y > canvas.height) {
            line.y = -CONFIG.canvasHeight / 20;
        }
    }
}

// Update Background
function updateBackground(deltaTime) {
    for (const elem of backgroundElements) {
        elem.y += elem.speed * gameState.speed * (deltaTime / 16.67);
        if (elem.y > canvas.height) {
            elem.y = -10;
            elem.x = Math.random() * canvas.width;
        }
    }
}

// Check Collisions
function checkCollisions() {
    const playerLeft = player.x - player.width / 2;
    const playerRight = player.x + player.width / 2;
    const playerTop = player.y - player.height / 2;
    const playerBottom = player.y + player.height / 2;

    // Obstacle collisions
    for (const obs of obstacles) {
        const obsLeft = obs.x - obs.width / 2;
        const obsRight = obs.x + obs.width / 2;
        const obsTop = obs.y - obs.height / 2;
        const obsBottom = obs.y + obs.height / 2;

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

        if (distance < 40) {
            coin.collected = true;
            collectCoin(coin);
        }
    }
}

function handleCrash() {
    gameState.lives--;

    // Crash particles
    for (let i = 0; i < 30; i++) {
        particles.push({
            x: player.x + (Math.random() - 0.5) * player.width,
            y: player.y + (Math.random() - 0.5) * player.height,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10 - 5,
            life: 1,
            decay: 0.02,
            color: CONFIG.colors.particle,
            size: Math.random() * 6 + 3
        });
    }

    // Screen shake effect
    canvas.style.animation = 'shake 0.3s ease-out';
    setTimeout(() => canvas.style.animation = '', 300);

    if (gameState.lives <= 0) {
        gameOver();
    } else {
        // Brief invincibility / reset position
        player.targetLane = 1;
        // Remove nearby obstacles
        for (let i = obstacles.length - 1; i >= 0; i--) {
            if (obstacles[i].y > player.y - 200) {
                obstacles.splice(i, 1);
            }
        }
    }
}

function collectCoin(coin) {
    gameState.score += 50;

    // Coin particles
    for (let i = 0; i < 15; i++) {
        particles.push({
            x: coin.x,
            y: coin.y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6 - 3,
            life: 1,
            decay: 0.03,
            color: CONFIG.colors.coin,
            size: Math.random() * 4 + 2
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

// Render
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
}

// Draw Background
function drawBackground() {
    for (const elem of backgroundElements) {
        if (elem.type === 'star') {
            ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + Math.sin(Date.now() * 0.005 + elem.x) * 0.3})`;
            ctx.beginPath();
            ctx.arc(elem.x, elem.y, elem.size, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = `rgba(0, 212, 255, ${0.3 + Math.sin(Date.now() * 0.003 + elem.y) * 0.2})`;
            ctx.fillRect(elem.x, elem.y, elem.size * 2, elem.size * 2);
        }
    }
}

// Draw Road
function drawRoad() {
    const roadLeft = canvas.width / 2 - CONFIG.roadWidth / 2;

    // Road surface
    const gradient = ctx.createLinearGradient(roadLeft, 0, roadLeft + CONFIG.roadWidth, 0);
    gradient.addColorStop(0, '#111');
    gradient.addColorStop(0.5, '#1a1a2e');
    gradient.addColorStop(1, '#111');
    ctx.fillStyle = gradient;
    ctx.fillRect(roadLeft, 0, CONFIG.roadWidth, canvas.height);

    // Road edges
    ctx.strokeStyle = CONFIG.colors.roadLine;
    ctx.lineWidth = 4;
    ctx.shadowColor = CONFIG.colors.roadLine;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(roadLeft, 0);
    ctx.lineTo(roadLeft, canvas.height);
    ctx.moveTo(roadLeft + CONFIG.roadWidth, 0);
    ctx.lineTo(roadLeft + CONFIG.roadWidth, canvas.height);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Lane dividers
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([20, 20]);
    for (let i = 1; i < CONFIG.laneCount; i++) {
        const x = roadLeft + i * laneWidth;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    ctx.setLineDash([]);
}

// Draw Road Lines
function drawRoadLines() {
    ctx.fillStyle = CONFIG.colors.roadLine;
    ctx.shadowColor = CONFIG.colors.roadLine;
    ctx.shadowBlur = 5;

    for (const line of roadLines) {
        // Center line
        const centerX = canvas.width / 2;
        ctx.fillRect(centerX - 2, line.y, 4, CONFIG.canvasHeight / 20 * 0.6);

        // Side lines
        const roadLeft = canvas.width / 2 - CONFIG.roadWidth / 2;
        const roadRight = canvas.width / 2 + CONFIG.roadWidth / 2;
        ctx.fillRect(roadLeft - 2, line.y, 4, CONFIG.canvasHeight / 20 * 0.6);
        ctx.fillRect(roadRight - 2, line.y, 4, CONFIG.canvasHeight / 20 * 0.6);
    }
    ctx.shadowBlur = 0;
}

// Draw Player Bike
function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.lean);

    // Exhaust glow when boosting
    if (gameState.boostActive) {
        const boostGradient = ctx.createRadialGradient(0, player.height / 2 + 15, 0, 0, player.height / 2 + 15, 30);
        boostGradient.addColorStop(0, 'rgba(255, 100, 0, 0.5)');
        boostGradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
        ctx.fillStyle = boostGradient;
        ctx.fillRect(-30, player.height / 2, 60, 40);
    }

    // Wheels
    drawWheel(-player.width / 2 + 8, player.height / 2 - 5, player.wheelRotation);
    drawWheel(player.width / 2 - 8, player.height / 2 - 5, player.wheelRotation);
    drawWheel(-player.width / 2 + 8, -player.height / 2 + 5, player.wheelRotation);
    drawWheel(player.width / 2 - 8, -player.height / 2 + 5, player.wheelRotation);

    // Bike body
    const bodyGradient = ctx.createLinearGradient(-player.width / 2, 0, player.width / 2, 0);
    bodyGradient.addColorStop(0, CONFIG.colors.playerDark);
    bodyGradient.addColorStop(0.5, CONFIG.colors.playerBody);
    bodyGradient.addColorStop(1, CONFIG.colors.playerDark);
    ctx.fillStyle = bodyGradient;

    // Main body
    ctx.beginPath();
    ctx.roundRect(-player.width / 2, -player.height / 2 + 10, player.width, player.height - 20, 8);
    ctx.fill();

    // Seat
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.roundRect(-15, -player.height / 2 + 15, 30, 25, 5);
    ctx.fill();

    // Engine block
    ctx.fillStyle = CONFIG.colors.playerDark;
    ctx.beginPath();
    ctx.roundRect(-20, -10, 40, 35, 5);
    ctx.fill();

    // Accent lines
    ctx.strokeStyle = CONFIG.colors.playerAccent;
    ctx.lineWidth = 2;
    ctx.shadowColor = CONFIG.colors.playerAccent;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.moveTo(-player.width / 2 + 5, -player.height / 2 + 20);
    ctx.lineTo(player.width / 2 - 5, -player.height / 2 + 20);
    ctx.moveTo(-player.width / 2 + 5, player.height / 2 - 20);
    ctx.lineTo(player.width / 2 - 5, player.height / 2 - 20);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Headlight
    const lightGradient = ctx.createRadialGradient(0, -player.height / 2 + 5, 0, 0, -player.height / 2 + 5, 15);
    lightGradient.addColorStop(0, 'rgba(255, 255, 200, 1)');
    lightGradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
    ctx.fillStyle = lightGradient;
    ctx.beginPath();
    ctx.arc(0, -player.height / 2 + 5, 15, -Math.PI, 0);
    ctx.fill();

    // Rider (simplified)
    ctx.fillStyle = '#222';
    // Helmet
    ctx.beginPath();
    ctx.ellipse(0, -player.height / 2 - 15, 14, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    // Visor
    ctx.fillStyle = 'rgba(0, 200, 255, 0.7)';
    ctx.beginPath();
    ctx.ellipse(0, -player.height / 2 - 18, 12, 8, 0, 0, Math.PI);
    ctx.fill();
    // Body
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.roundRect(-12, -player.height / 2 + 5, 24, 30, 5);
    ctx.fill();
    // Arms
    ctx.fillStyle = '#444';
    ctx.fillRect(-18, -player.height / 2 + 10, 8, 20);
    ctx.fillRect(10, -player.height / 2 + 10, 8, 20);

    ctx.restore();
}

function drawWheel(x, y, rotation) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    // Tire
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();

    // Rim
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();

    // Spokes
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 / 5) * i;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 4, Math.sin(angle) * 4);
        ctx.lineTo(Math.cos(angle) * 11, Math.sin(angle) * 11);
        ctx.stroke();
    }

    // Brake disc
    ctx.fillStyle = '#666';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// Draw Obstacles
function drawObstacles() {
    for (const obs of obstacles) {
        ctx.save();
        ctx.translate(obs.x, obs.y);

        // Vehicle body
        ctx.fillStyle = obs.color;
        ctx.beginPath();
        ctx.roundRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height, 8);
        ctx.fill();

        // Details based on type
        if (obs.type === 'car') {
            drawCarDetails(obs.width, obs.height);
        } else if (obs.type === 'truck') {
            drawTruckDetails(obs.width, obs.height);
        } else if (obs.type === 'bus') {
            drawBusDetails(obs.width, obs.height);
        }

        // Wheels
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(-obs.width / 2 + 10, -obs.height / 2 + 10, 12, 0, Math.PI * 2);
        ctx.arc(obs.width / 2 - 10, -obs.height / 2 + 10, 12, 0, Math.PI * 2);
        ctx.arc(-obs.width / 2 + 10, obs.height / 2 - 10, 12, 0, Math.PI * 2);
        ctx.arc(obs.width / 2 - 10, obs.height / 2 - 10, 12, 0, Math.PI * 2);
        ctx.fill();

        // Headlights/Taillights
        if (obs.y < player.y) {
            // Taillights (red)
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(-obs.width / 2 + 5, obs.height / 2 - 10, 15, 8);
            ctx.fillRect(obs.width / 2 - 20, obs.height / 2 - 10, 15, 8);
        } else {
            // Headlights (white/yellow)
            ctx.fillStyle = '#fff';
            ctx.fillRect(-obs.width / 2 + 5, -obs.height / 2 + 2, 15, 8);
            ctx.fillRect(obs.width / 2 - 20, -obs.height / 2 + 2, 15, 8);
        }

        ctx.restore();
    }
}

function drawCarDetails(width, height) {
    // Windows
    ctx.fillStyle = 'rgba(100, 200, 255, 0.6)';
    ctx.beginPath();
    ctx.roundRect(-width / 2 + 8, -height / 2 + 15, width - 16, 35, 4);
    ctx.fill();

    // Roof line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-width / 2 + 5, -height / 2 + 15);
    ctx.lineTo(width / 2 - 5, -height / 2 + 15);
    ctx.stroke();
}

function drawTruckDetails(width, height) {
    // Cab
    ctx.fillStyle = 'rgba(100, 200, 255, 0.6)';
    ctx.beginPath();
    ctx.roundRect(-width / 2 + 5, -height / 2 + 10, width - 10, 30, 4);
    ctx.fill();

    // Cargo area lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
        const y = -height / 2 + 50 + i * 20;
        ctx.beginPath();
        ctx.moveTo(-width / 2 + 10, y);
        ctx.lineTo(width / 2 - 10, y);
        ctx.stroke();
    }
}

function drawBusDetails(width, height) {
    // Windows row
    ctx.fillStyle = 'rgba(100, 200, 255, 0.6)';
    const windowWidth = 18;
    const windowGap = 6;
    const startX = -width / 2 + 10;
    for (let i = 0; i < 5; i++) {
        ctx.fillRect(startX + i * (windowWidth + windowGap), -height / 2 + 15, windowWidth, 25);
    }

    // Door
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-width / 2 + 5, -height / 2 + 10, 30, height - 20);
}

// Draw Coins
function drawCoins() {
    for (const coin of coins) {
        if (coin.collected) continue;

        ctx.save();
        ctx.translate(coin.x, coin.y + Math.sin(coin.bounce) * 5);
        ctx.rotate(coin.rotation);

        // Coin glow
        const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
        glowGradient.addColorStop(0, 'rgba(255, 215, 0, 0.5)');
        glowGradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = glowGradient;
        ctx.fillRect(-20, -20, 40, 40);

        // Coin body
        ctx.fillStyle = CONFIG.colors.coin;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();

        // Inner circle
        ctx.fillStyle = '#e6c200';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();

        // $ sign
        ctx.fillStyle = '#b89600';
        ctx.font = 'bold 18px Arial';
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
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
        const x = Math.random() * canvas.width;
        const y = (Date.now() * 0.5 + i * 72) % canvas.height;
        const length = 50 + Math.random() * 100;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + length);
        ctx.stroke();
    }

    // Boost text
    ctx.fillStyle = 'rgba(0, 212, 255, ' + (0.5 + Math.sin(Date.now() * 0.01) * 0.3) + ')';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#00d4ff';
    ctx.shadowBlur = 20;
    ctx.fillText('BOOST!', canvas.width / 2, 80);
    ctx.shadowBlur = 0;
}

// Event Listeners
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
canvas.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
}, { passive: true });

canvas.addEventListener('touchmove', (e) => {
    const diff = e.touches[0].clientX - touchStartX;
    if (Math.abs(diff) > 30) {
        if (diff < 0 && player.targetLane > 0) {
            player.targetLane--;
        } else if (diff > 0 && player.targetLane < CONFIG.laneCount - 1) {
            player.targetLane++;
        }
        touchStartX = e.touches[0].clientX;
    }
}, { passive: true });

canvas.addEventListener('touchend', () => {
    // Tap to boost
    if (!gameState.boostActive && timestamp > gameState.boostCooldownEnd) {
        activateBoost();
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
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
}
`;
document.head.appendChild(style);