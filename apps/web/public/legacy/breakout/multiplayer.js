(function() {
    if (!window.location.search.includes('mp=1')) {
        return;
    }

    console.log("Breakout Multiplayer script active.");

    // Seeded PRNG (Mulberry32)
    let currentSeed = 1;
    function mulberry32(a) {
        return function() {
            let t = a += 0x6D2B79F5;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        }
    }
    let prng = mulberry32(currentSeed);

    BreakOut.seedRandom = function(seed) {
        currentSeed = seed;
        prng = mulberry32(seed);
    };

    BreakOut.random = function() {
        return prng();
    };

    // Multiplayer session state
    let mySeat = null;
    const inputsA = {};
    const inputsB = {};
    let currentInputA = { dir: 0, shoot: false };
    let currentInputB = { dir: 0, shoot: false };
    const N = 1; // input delay in ticks (16.6ms) for immediate local play feel
    let tick = 0;
    let remoteMaxTick = N;
    let isStarted = false;
    let playerA = null;
    let playerB = null;
    let lastLocalInput = { dir: 0, shoot: false };
    let hasInitialized = false;
    let isUsingMouse = false;

    // Intercept default init by overwriting window.onload
    window.onload = function() {
        console.log("Multiplayer initialization started via window.onload.");
        // Load sounds
        for (var i = 0; i < soundFiles.length; i++) {
            var sound = soundFiles[i];
            sounds[sound.key] = new Howl({
                src: BreakOut.settings.assetDir + sound.src,
                autoplay: sound.autoplay || false,
                volume: sound.volume || 1,
                loop: sound.loop || false
            });
        }

        // Setup PIXI renderer & stage
        var w = 1280;
        var h = 720;
        BreakOut.settings.width = w;
        BreakOut.settings.height = h;
        PIXI.scaleModes.DEFAULT = PIXI.scaleModes.NEAREST;
        renderer = new PIXI.lights.WebGLDeferredRenderer(w, h, {transparent: true});
        stage = new PIXI.Container();
        document.getElementById('game').innerHTML = '';
        document.getElementById('game').appendChild(renderer.view);

        // Init BreakOut core (no level loading yet — wait for init message)
        BreakOut.init();
        BreakOut.currentLevel = 0;

        // Add both players (A = bottom, B = top)
        const pA = BreakOut.addPlayer('player-A');
        const pB = BreakOut.addPlayer('player-B');
        playerA = pA.element;
        playerB = pB.element;

        // Set explicit colors for visual consistency
        playerA.object.tint = 0x8b5cf6; // Purple
        playerB.object.tint = 0xec4899; // Pink
        if (playerA.object.children[0]) playerA.object.children[0].color = 0x8b5cf6;
        if (playerB.object.children[0]) playerB.object.children[0].color = 0xec4899;

        // Notify parent we are ready to receive init
        window.parent.postMessage({
            source: "playground-legacy-game",
            gameKey: "breakout",
            type: "ready"
        }, window.location.origin);
    };

    // Listen to parent window messages
    window.addEventListener('message', function(event) {
        if (event.origin !== window.location.origin) return;
        const data = event.data;
        if (data.source !== 'playground-board' || data.gameKey !== 'breakout') return;

        if (data.type === 'init') {
            if (hasInitialized) {
                console.log("Ignore subsequent init calls.");
                return;
            }
            hasInitialized = true;
            console.log("Initialising multiplayer with seat:", data.seat, "seed:", data.seed, "level:", data.currentLevel);
            mySeat = data.seat;
            BreakOut.seedRandom(data.seed);

            // Set the starting level (for resume support)
            if (typeof data.currentLevel === 'number' && data.currentLevel > 0) {
                BreakOut.currentLevel = data.currentLevel;
            } else {
                BreakOut.currentLevel = 0;
            }

            // Load the first level now that we know which one to load
            BreakOut.loadLevel();

            // Seed initial inputs
            for (let t = 0; t <= N; t++) {
                inputsA[t] = { dir: 0, shoot: false };
                inputsB[t] = { dir: 0, shoot: false };
            }

            isStarted = true;
            lastTime = performance.now();
            requestAnimationFrame(tickLoop);

            // Broadcast initial inputs
            for (let t = 0; t <= N; t++) {
                sendInput(t, 0, false);
            }
        }
        else if (data.type === 'input') {
            const input = data.input;
            if (input.seat === 'A') {
                inputsA[input.tick] = { dir: input.dir, shoot: input.shoot };
            } else {
                inputsB[input.tick] = { dir: input.dir, shoot: input.shoot };
            }
            remoteMaxTick = Math.max(remoteMaxTick, input.tick);
        }
        else if (data.type === 'heartbeat') {
            remoteMaxTick = Math.max(remoteMaxTick, data.heartbeat.tick);
        }
    });

    function sendInput(applyTick, dir, shoot) {
        window.parent.postMessage({
            source: "playground-legacy-game",
            gameKey: "breakout",
            type: "input",
            input: {
                kind: "input",
                seat: mySeat,
                tick: applyTick,
                dir: dir,
                shoot: shoot
            }
        }, window.location.origin);
    }

    function sendHeartbeat(currentTick) {
        window.parent.postMessage({
            source: "playground-legacy-game",
            gameKey: "breakout",
            type: "heartbeat",
            heartbeat: {
                seat: mySeat,
                tick: currentTick
            }
        }, window.location.origin);
    }

    function postEnd(result) {
        window.parent.postMessage({
            source: "playground-legacy-game",
            gameKey: "breakout",
            type: "end",
            result: result
        }, window.location.origin);
    }

    // Keyboard support
    const activeKeys = {};
    window.addEventListener('keydown', function(e) {
        activeKeys[e.key] = true;
        isUsingMouse = false; // Disable mouse follow on keypress
        if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 's', 'a', 'd', 'W', 'S', 'A', 'D'].indexOf(e.key) > -1) {
            e.preventDefault();
        }
    });
    window.addEventListener('keyup', function(e) {
        activeKeys[e.key] = false;
        if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 's', 'a', 'd', 'W', 'S', 'A', 'D'].indexOf(e.key) > -1) {
            e.preventDefault();
        }
    });

    // Mouse support (deterministic conversion to direction)
    let localMouseX = null;
    let localShootPressed = false;
    document.body.addEventListener('mousemove', function(e) {
        document.body.style.cursor = 'default';
        clearTimeout(mouseHideTimeOut);
        mouseHideTimeOut = setTimeout(hideCursor, 2000);
        var scaleX = BreakOut.settings.width / (window.innerWidth || 1);
        localMouseX = e.clientX * scaleX;
        isUsingMouse = true; // Re-enable mouse follow on movement
    });
    document.body.addEventListener('click', function(e) {
        localShootPressed = true;
    });

    // Main tick loop
    let accumulator = 0;
    let lastTime = 0;
    const dt = 1000 / 60; // 16.666 ms (60 FPS)

    function tickLoop(timestamp) {
        if (!isStarted) return;
        if (!lastTime) lastTime = timestamp;
        let elapsed = timestamp - lastTime;
        lastTime = timestamp;

        // Cap elapsed to avoid spiral of death
        if (elapsed > 100) elapsed = 100;

        accumulator += elapsed;
        while (accumulator >= dt) {
            if (!stepSimulation()) {
                break; // Stalled waiting for remote input
            }
            accumulator -= dt;
        }

        // Render at screen refresh rate
        renderer.render(stage);
        requestAnimationFrame(tickLoop);
    }

    function stepSimulation() {
        if (tick > remoteMaxTick) {
            if (tick % 60 === 0) {
                console.log("Lockstep stalled at tick", tick, "remoteMaxTick =", remoteMaxTick);
            }
            return false; // Stall
        }

        // Resolve inputs for current tick
        if (inputsA[tick] !== undefined) {
            currentInputA = inputsA[tick];
        } else {
            inputsA[tick] = currentInputA;
        }

        if (inputsB[tick] !== undefined) {
            currentInputB = inputsB[tick];
        } else {
            inputsB[tick] = currentInputB;
        }

        // Apply inputs to paddles
        if (playerA) {
            playerA.object.position.x = Math.max(50, Math.min(BreakOut.settings.width - 50, playerA.object.position.x + currentInputA.dir));
            if (currentInputA.shoot) {
                playerA.shoot();
                currentInputA.shoot = false;
            }
        }

        if (playerB) {
            playerB.object.position.x = Math.max(50, Math.min(BreakOut.settings.width - 50, playerB.object.position.x + currentInputB.dir));
            if (currentInputB.shoot) {
                playerB.shoot();
                currentInputB.shoot = false;
            }
        }

        // Step physics simulation
        BreakOut.update(16.666);

        // Win/loss detection
        // All levels completed
        if (BreakOut.currentLevel >= BreakOut.levels.length) {
            isStarted = false;
            postEnd("won");
            return true;
        }

        // Score dropped below -500
        if (BreakOut.score.A <= -500 || BreakOut.score.B <= -500) {
            isStarted = false;
            postEnd("lost");
            return true;
        }

        // Capture local input for tick + N
        let localDir = 0;
        if (activeKeys['ArrowLeft'] || activeKeys['a'] || activeKeys['A']) {
            localDir = -8; // Move left by 8 pixels
        } else if (activeKeys['ArrowRight'] || activeKeys['d'] || activeKeys['D']) {
            localDir = 8;  // Move right by 8 pixels
        } else if (isUsingMouse && localMouseX !== null) {
            const myPaddle = (mySeat === 'A') ? playerA : playerB;
            if (myPaddle) {
                const diff = localMouseX - myPaddle.object.position.x;
                // Move instantly by the full difference to follow the mouse instantly (no max speed clamp)
                localDir = Math.round(diff);
            }
        }
        let localShoot = false;
        if (activeKeys[' '] || activeKeys['ArrowUp'] || activeKeys['w'] || activeKeys['W'] || localShootPressed) {
            localShoot = true;
            activeKeys[' '] = false;
            activeKeys['ArrowUp'] = false;
            activeKeys['w'] = false;
            activeKeys['W'] = false;
            localShootPressed = false;
        }

        const targetTick = tick + N;
        if (localDir !== lastLocalInput.dir || localShoot) {
            lastLocalInput = { dir: localDir, shoot: localShoot };
            if (mySeat === 'A') {
                inputsA[targetTick] = { dir: localDir, shoot: localShoot };
            } else {
                inputsB[targetTick] = { dir: localDir, shoot: localShoot };
            }
            sendInput(targetTick, localDir, localShoot);
        }

        tick++;

        // Send heartbeat every tick to prevent deadlocks
        sendHeartbeat(tick);

        return true;
    }
})();
