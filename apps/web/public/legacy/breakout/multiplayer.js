(function() {
    if (!window.location.search.includes('mp=1')) {
        return;
    }

    console.log("Breakout Multiplayer script active.");

    let mySeat = null;
    let isAuthority = false;

    // --- Seeded PRNG (Mulberry32) with explicit state ---
    let currentSeed = 1;
    let rngState = 1;

    function mulberry32() {
        let t = rngState += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    BreakOut.seedRandom = function(seed) {
        currentSeed = seed;
        rngState = seed;
    };

    BreakOut.random = function() {
        return mulberry32();
    };

    BreakOut.getRngState = function() {
        return rngState;
    };

    BreakOut.setRngState = function(a) {
        rngState = a;
    };

    // --- Level cache (sync load for mp) ---
    const levelCache = {};
    let levelsPreloaded = false;

    function preloadLevels(done) {
        const files = BreakOut.levels;
        if (files.length === 0) {
            levelsPreloaded = true;
            done();
            return;
        }
        let loaded = 0;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            ajax(BreakOut.settings.assetDir + file, function(jsonData) {
                levelCache[file] = JSON.parse(jsonData);
                loaded++;
                if (loaded === files.length) {
                    levelsPreloaded = true;
                    done();
                }
            });
        }
    }

    const BRICK_TYPE_MAP = {
        BrickStar: 'brick-star',
        BrickFire: 'brick-fire',
        BrickIce: 'brick-ice',
        BrickColorOrange: 'brick-color-orange',
        BrickColorRed: 'brick-color-red',
        BrickColorPurple: 'brick-color-purple',
        BrickSand: 'brick-sand',
        BrickStone: 'brick-stone-003',
        BrickFourStones: 'brick-4-001'
    };

    function getBrickTypeKey(brick) {
        if (brick.tileKey) {
            return brick.tileKey;
        }
        const shortName = brick.constructor.name.replace(/^BreakOut\./, '');
        return BRICK_TYPE_MAP[shortName] || 'brick';
    }

    function createBrickByKey(key) {
        key = key || 'brick';
        var brick;
        switch (key) {
            case 'brick-star': brick = new BreakOut.BrickStar(); break;
            case 'brick-fire': brick = new BreakOut.BrickFire(); break;
            case 'brick-ice': brick = new BreakOut.BrickIce(); break;
            case 'brick-color-orange': brick = new BreakOut.BrickColorOrange(); break;
            case 'brick-color-red': brick = new BreakOut.BrickColorRed(); break;
            case 'brick-color-purple': brick = new BreakOut.BrickColorPurple(); break;
            case 'brick-sand': brick = new BreakOut.BrickSand(); break;
            case 'brick-stone-003': brick = new BreakOut.BrickStone(); break;
            case 'brick-4-001': brick = new BreakOut.BrickFourStones(); break;
            default:
                brick = new BreakOut.Brick();
                if (key !== 'brick') {
                    brick.textures = [key + '.png'];
                }
        }
        brick.tileKey = key;
        return brick;
    }

    function placeBricksFromJson(jsonData) {
        var tileWidth = jsonData.tilewidth;
        var tileHeight = jsonData.tileheight;
        var tiles = [];
        var mapWidth = jsonData.width * tileWidth;
        var mapHeight = jsonData.height * tileHeight;
        var startX = (BreakOut.settings.width / 2) - (mapWidth / 2);
        var startY = (BreakOut.settings.height / 2) - (mapHeight / 2);

        for (var i = 0; i < jsonData.tilesets.length; i++) {
            for (var index in jsonData.tilesets[i].tiles) {
                if (jsonData.tilesets[i].tiles.hasOwnProperty(index)) {
                    var brickKey = 'brick';
                    try {
                        brickKey = jsonData.tilesets[i].tiles[index].image.replace(/(\.([a-zA-Z]+)$)/, '');
                    } catch (e) {}
                    jsonData.tilesets[i].tiles[index].key = brickKey;
                    tiles.push(jsonData.tilesets[i].tiles[index]);
                }
            }
        }

        var x = startX;
        var y = startY;
        for (var li = 0; li < jsonData.layers.length; li++) {
            for (var j = 0; j < jsonData.layers[li].data.length; j++) {
                if (j % jsonData.width === 0) {
                    y += tileHeight;
                    x = startX;
                }
                var tileIndex = jsonData.layers[li].data[j] - 1;
                if (typeof tiles[tileIndex] !== 'undefined') {
                    var brick = createBrickByKey(tiles[tileIndex].key);
                    brick.init();
                    brick.add();
                    brick.object.position.x = x + tileWidth / 2;
                    brick.object.position.y = y + tileHeight / 2;
                    BreakOut.totalBricks++;
                }
                x += tileWidth;
            }
        }
    }

    let levelsCompleted = 0;
    let pendingLevelSnapshot = false;
    let levelStartShootLock = 0;
    let lastCorrectedSnap = null;
    let ballCorrectionHold = 0;

    function resetBallsForLevel() {
        for (var i = 0; i < BreakOut.players.length; i++) {
            var player = BreakOut.players[i];
            var ball = ownedBallsByTeam[player.team] || player.element.ball;
            if (!ball) continue;
            player.element.ball = ball;
            var yPosBall = player.element.team === 'B' ? 22 : -22;
            detachBallFromAllPaddles(ball);
            ball.object.position.x = player.element.object.position.x;
            ball.object.position.y = player.element.object.position.y;
            ball.attachtTo = player.element;
            ball.attachtToPos = {
                x: BreakOut.random() * 56 - 28,
                y: yPosBall
            };
            player.element.attachedBalls = [];
            player.element.attachedBalls.push(ball);
        }
    }

    function clearAllBricks() {
        var toRemove = [];
        for (var i = 0; i < BreakOut.objects.length; i++) {
            if (BreakOut.objects[i].name === 'brick') {
                toRemove.push(BreakOut.objects[i]);
            }
        }
        for (var j = 0; j < toRemove.length; j++) {
            silentRemove(toRemove[j]);
        }
        BreakOut.totalBricks = 0;
    }

    function placeBricksFromSnapshot(bricks) {
        for (var i = 0; i < bricks.length; i++) {
            var sb = bricks[i];
            var brick = createBrickByKey(sb.brickKey || 'brick');
            brick.init();
            brick.add();
            brick.object.position.x = sb.x;
            brick.object.position.y = sb.y;
            setBrickTexIdx(brick, sb.texIdx);
        }
        BreakOut.totalBricks = bricks.length;
    }

    function loadLevelSync(quiet) {
        clearAllBonuses();
        clearAllBricks();
        resetBallsForLevel();

        if (typeof BreakOut.levels[BreakOut.currentLevel] === 'undefined') {
            BreakOut.currentLevel = 0;
        }
        var file = BreakOut.levels[BreakOut.currentLevel];
        var jsonData = levelCache[file];
        if (!jsonData) {
            console.error('Level not in cache:', file);
            return;
        }

        if (!quiet && BreakOut.firstLevelLoaded === true) {
            sounds['next-level'].play();
        }
        BreakOut.firstLevelLoaded = true;

        placeBricksFromJson(jsonData);
        levelStartShootLock = 45;

        if (isAuthority) {
            pendingLevelSnapshot = true;
        }
    }

    function getBallDataForTeam(snap, team) {
        if (!snap || !snap.balls) return null;
        for (var i = 0; i < snap.balls.length; i++) {
            if (snap.balls[i].team === team) {
                return snap.balls[i];
            }
        }
        return null;
    }

    function getPlayerByTeam(team) {
        for (var i = 0; i < BreakOut.players.length; i++) {
            if (BreakOut.players[i].team === team) {
                return BreakOut.players[i];
            }
        }
        return null;
    }

    function detachBallFromAllPaddles(ball) {
        for (var i = 0; i < BreakOut.players.length; i++) {
            var paddle = BreakOut.players[i].element;
            var kept = [];
            for (var j = 0; j < paddle.attachedBalls.length; j++) {
                if (paddle.attachedBalls[j] !== ball) {
                    kept.push(paddle.attachedBalls[j]);
                }
            }
            paddle.attachedBalls = kept;
        }
    }

    function setBallPrevPosition(ball, x, y) {
        ball.prevPosition.x = x;
        ball.prevPosition.y = y;
        if (ball.stats && ball.stats.prevPosition) {
            ball.stats.prevPosition.x = x;
            ball.stats.prevPosition.y = y;
        }
    }

    function applyBallFromSnapshot(player, ballData) {
        if (!ballData) return;
        var ball = ownedBallsByTeam[player.team] || player.element.ball;
        if (!ball) return;
        player.element.ball = ball;
        ball.object.position.x = ballData.x;
        ball.object.position.y = ballData.y;
        ball.hasFire = !!ballData.hasFire;
        if (typeof ballData.maxSpeed === 'number') {
            ball.stats.maxSpeed = ballData.maxSpeed;
        }
        if (ballData.attached) {
            var attachedPlayer = getPlayerByTeam(ballData.attachedTeam) || player;
            detachBallFromAllPaddles(ball);
            ball.attachtTo = attachedPlayer.element;
            ball.attachtToPos = { x: ballData.attachX, y: ballData.attachY };
            attachedPlayer.element.attachedBalls.push(ball);
            ball.stats.speed.x = 0;
            ball.stats.speed.y = 0;
        } else {
            detachBallFromAllPaddles(ball);
            ball.attachtTo = '';
            ball.stats.speed.x = ballData.vx;
            ball.stats.speed.y = ballData.vy;
        }
        var prevX = typeof ballData.prevX === 'number' ? ballData.prevX : ballData.x - ball.stats.speed.x;
        var prevY = typeof ballData.prevY === 'number' ? ballData.prevY : ballData.y - ball.stats.speed.y;
        setBallPrevPosition(ball, prevX, prevY);
    }

    function reapplyBallsFromCorrectedSnap() {
        if (!lastCorrectedSnap) return;
        for (var i = 0; i < BreakOut.players.length; i++) {
            applyBallFromSnapshot(BreakOut.players[i], getBallDataForTeam(lastCorrectedSnap, BreakOut.players[i].team));
        }
    }

    function clearShootInput() {
        localShootPressed = false;
        activeKeys[' '] = false;
        activeKeys['ArrowUp'] = false;
        activeKeys['w'] = false;
        activeKeys['W'] = false;
    }

    BreakOut.loadLevel = loadLevelSync;

    // Both clients drop bonuses from the shared seeded RNG; snapshots only correct drift.
    BreakOut.Brick.prototype.remove = function() {
        dropBonusFromBrick(this);
        BreakOut.Element.prototype.remove.call(this);
    };

    // Only seat A advances levels; guests wait for snapshots to avoid level flashes.
    const origElementRemove = BreakOut.Element.prototype.remove;
    BreakOut.Element.prototype.remove = function() {
        if (this.name === 'brick') {
            var completingLevel = (BreakOut.totalBricks === 1);

            if (this.object != null) {
                stage.removeChild(this.object);
            }
            var idx = BreakOut.objects.indexOf(this);
            if (idx >= 0) {
                BreakOut.objects.splice(idx, 1);
            }
            BreakOut.totalBricks = Math.max(0, BreakOut.totalBricks - 1);

            if (completingLevel && isAuthority) {
                levelsCompleted++;
                if (levelsCompleted >= BreakOut.levels.length) {
                    BreakOut.totalBricks = 0;
                    isStarted = false;
                    sendSnapshot();
                    postEnd("won");
                    return;
                }
                BreakOut.currentLevel++;
                if (BreakOut.currentLevel >= BreakOut.levels.length) {
                    BreakOut.currentLevel = 0;
                }
                sendCheckpoint();
                loadLevelSync(false);
            }
            return;
        }
        origElementRemove.call(this);
    };

    function silentRemove(obj) {
        if (obj.object != null) {
            stage.removeChild(obj.object);
        }
        var idx = BreakOut.objects.indexOf(obj);
        if (idx >= 0) {
            BreakOut.objects.splice(idx, 1);
        }
        if (obj.name === 'brick') {
            BreakOut.totalBricks = Math.max(0, BreakOut.totalBricks - 1);
        }
    }

    function brickPosKey(x, y) {
        return Math.round(x) + '_' + Math.round(y);
    }

    function findBrickAt(x, y) {
        var key = brickPosKey(x, y);
        for (var i = 0; i < BreakOut.objects.length; i++) {
            var obj = BreakOut.objects[i];
            if (obj.name === 'brick' && obj.object.visible) {
                if (brickPosKey(obj.object.position.x, obj.object.position.y) === key) {
                    return obj;
                }
            }
        }
        return null;
    }

    function getBrickTexIdx(brick) {
        var tex = brick.object._originalTexture || brick.object.texture;
        var idx = brick.textures.indexOf(tex);
        if (idx < 0) {
            return brick.textures.length - 1;
        }
        return idx;
    }

    function setBrickTexIdx(brick, texIdx) {
        if (typeof brick.textures[texIdx] !== 'undefined') {
            brick.object._originalTexture = brick.textures[texIdx];
            brick.object.texture = brick.textures[texIdx];
        }
    }

    function createBonusFromPick(pick) {
        switch (pick) {
            case 'bonus-coin': return new BreakOut.BonusCoin();
            case 'bonus-freeze': return new BreakOut.BonusFreeze();
            case 'bonus-sticky': return new BreakOut.BonusSticky();
            case 'bonus-fire': return new BreakOut.BonusFire();
            case 'bonus-shoot': return new BreakOut.BonusShoot();
            default: return new BreakOut.Bonus();
        }
    }

    function clearAllBonuses() {
        var toRemove = [];
        for (var i = 0; i < BreakOut.objects.length; i++) {
            if (BreakOut.objects[i].name === 'bonus') {
                toRemove.push(BreakOut.objects[i]);
            }
        }
        for (var j = 0; j < toRemove.length; j++) {
            silentRemove(toRemove[j]);
        }
    }

    function bonusSpawnKey(x, y) {
        return Math.round(x) + '_' + Math.round(y);
    }

    function findBonusBySpawnKey(key) {
        for (var i = 0; i < BreakOut.objects.length; i++) {
            var bonus = BreakOut.objects[i];
            if (bonus.name === 'bonus' && bonus.object.visible) {
                if (bonusSpawnKey(bonus.spawnX, bonus.spawnY) === key) {
                    return bonus;
                }
            }
        }
        return null;
    }

    function dropBonusFromBrick(brick) {
        if (brick.bonuses.length === 0 || BreakOut.random() * 100 >= brick.dropChance) {
            return;
        }
        var pick = brick.bonuses[Math.floor(BreakOut.random() * brick.bonuses.length)];
        var bonus = createBonusFromPick(pick);
        bonus.mpType = pick;
        bonus.spawnX = brick.object.position.x;
        bonus.spawnY = brick.object.position.y;
        bonus.init();
        bonus.add();
        bonus.object.position.x = brick.object.position.x;
        bonus.object.position.y = brick.object.position.y;
        bonus.team = brick.team;
        bonus.object.visible = true;
    }

    function sendCheckpoint() {
        if (!isAuthority) return;
        window.parent.postMessage({
            source: "playground-legacy-game",
            gameKey: "breakout",
            type: "checkpoint",
            state: { currentLevel: Number(BreakOut.currentLevel) }
        }, window.location.origin);
    }

    function correctBonusesFromSnapshot(snap) {
        var snapBySpawn = {};
        var list = snap.bonuses || [];
        for (var i = 0; i < list.length; i++) {
            var b = list[i];
            snapBySpawn[bonusSpawnKey(b.spawnX, b.spawnY)] = b;
        }

        var toRemove = [];
        for (var j = 0; j < BreakOut.objects.length; j++) {
            var bonus = BreakOut.objects[j];
            if (bonus.name !== 'bonus' || !bonus.object.visible) continue;
            var key = bonusSpawnKey(bonus.spawnX, bonus.spawnY);
            if (!snapBySpawn[key]) {
                toRemove.push(bonus);
            }
        }
        for (var r = 0; r < toRemove.length; r++) {
            silentRemove(toRemove[r]);
        }

        for (var key in snapBySpawn) {
            if (!snapBySpawn.hasOwnProperty(key)) continue;
            var sb = snapBySpawn[key];
            var existing = findBonusBySpawnKey(key);
            if (existing) {
                if (existing.mpType !== sb.type) {
                    silentRemove(existing);
                    existing = null;
                } else {
                    existing.object.position.x = sb.x;
                    existing.object.position.y = sb.y;
                    existing.team = sb.team || existing.team;
                }
            }
            if (!existing) {
                var created = createBonusFromPick(sb.type);
                created.mpType = sb.type;
                created.spawnX = sb.spawnX;
                created.spawnY = sb.spawnY;
                created.init();
                created.add();
                created.object.position.x = sb.x;
                created.object.position.y = sb.y;
                created.team = sb.team || '';
                created.object.visible = true;
            }
        }
    }

    // --- Multiplayer session state ---
    const SNAPSHOT_INTERVAL = 30;
    let tick = 0;
    let isStarted = false;
    let isPaused = false;
    let playerA = null;
    let playerB = null;
    const ownedBallsByTeam = { A: null, B: null };
    let hasInitialized = false;
    let isUsingMouse = false;

    // Each player owns their paddle: send absolute X, never replay partner dir deltas.
    const remotePaddleX = { A: null, B: null };
    const lastAppliedRemoteShoot = { A: -1, B: -1 };

    function clampPaddleX(x) {
        return Math.max(50, Math.min(BreakOut.settings.width - 50, x));
    }

    function getPaddleForSeat(seat) {
        return seat === 'A' ? playerA : playerB;
    }

    window.onload = function() {
        console.log("Multiplayer initialization started via window.onload.");
        for (var i = 0; i < soundFiles.length; i++) {
            var sound = soundFiles[i];
            sounds[sound.key] = new Howl({
                src: BreakOut.settings.assetDir + sound.src,
                autoplay: sound.autoplay || false,
                volume: sound.volume || 1,
                loop: sound.loop || false
            });
        }

        var w = 1280;
        var h = 720;
        BreakOut.settings.width = w;
        BreakOut.settings.height = h;
        PIXI.scaleModes.DEFAULT = PIXI.scaleModes.NEAREST;
        renderer = new PIXI.lights.WebGLDeferredRenderer(w, h, {transparent: true});
        stage = new PIXI.Container();
        document.getElementById('game').innerHTML = '';
        document.getElementById('game').appendChild(renderer.view);

        BreakOut.init();
        BreakOut.currentLevel = 0;

        var pA = BreakOut.addPlayer('player-A');
        var pB = BreakOut.addPlayer('player-B');
        playerA = pA.element;
        playerB = pB.element;
        ownedBallsByTeam.A = pA.element.ball;
        ownedBallsByTeam.B = pB.element.ball;

        playerA.object.tint = 0x8b5cf6;
        playerB.object.tint = 0xec4899;
        if (playerA.object.children[0]) playerA.object.children[0].color = 0x8b5cf6;
        if (playerB.object.children[0]) playerB.object.children[0].color = 0xec4899;

        preloadLevels(function() {
            window.parent.postMessage({
                source: "playground-legacy-game",
                gameKey: "breakout",
                type: "ready"
            }, window.location.origin);
        });
    };

    window.addEventListener('message', function(event) {
        if (event.origin !== window.location.origin) return;
        const data = event.data;
        if (data.source !== 'playground-board' || data.gameKey !== 'breakout') return;

        if (data.type === 'init') {
            if (hasInitialized) return;
            if (!levelsPreloaded) return;
            hasInitialized = true;
            mySeat = data.seat;
            isAuthority = data.isAuthority === true;
            BreakOut.seedRandom(data.seed);

            if (typeof data.currentLevel === 'number') {
                BreakOut.currentLevel = Math.max(0, Math.floor(data.currentLevel));
            } else {
                BreakOut.currentLevel = 0;
            }
            levelsCompleted = BreakOut.currentLevel;

            BreakOut.loadLevel();

            isStarted = true;
            lastTime = performance.now();
            requestAnimationFrame(tickLoop);

            // Authority: if a liveSnapshot is provided, restore the full mid-game state
            if (isAuthority && data.liveSnapshot) {
                applyLiveSnapshotAsAuthority(data.liveSnapshot);
            }

            if (!isAuthority) {
                window.parent.postMessage({
                    source: "playground-legacy-game",
                    gameKey: "breakout",
                    type: "need-snapshot"
                }, window.location.origin);
            }
        }
        else if (data.type === 'need-snapshot' && isAuthority) {
            sendSnapshot();
        }
        else if (data.type === 'request-save-snapshot' && isAuthority) {
            // Parent is requesting us to emit our current full snapshot for persistence
            sendSnapshot();
        }
        else if (data.type === 'resync-level' && !isAuthority && typeof data.currentLevel === 'number') {
            var syncedLevel = Math.max(0, Math.floor(data.currentLevel));
            if (syncedLevel !== BreakOut.currentLevel || levelsCompleted !== syncedLevel) {
                BreakOut.currentLevel = syncedLevel;
                levelsCompleted = syncedLevel;
                loadLevelSync(true);
                window.parent.postMessage({
                    source: "playground-legacy-game",
                    gameKey: "breakout",
                    type: "need-snapshot"
                }, window.location.origin);
            }
        }
        else if (data.type === 'paddle' && data.paddle) {
            const p = data.paddle;
            if (p.seat === 'A' || p.seat === 'B') {
                remotePaddleX[p.seat] = p.x;
                if (p.shoot && p.tick > lastAppliedRemoteShoot[p.seat]) {
                    const paddle = getPaddleForSeat(p.seat);
                    if (paddle && p.seat !== mySeat) {
                        paddle.shoot();
                        lastAppliedRemoteShoot[p.seat] = p.tick;
                    }
                }
            }
        }
        else if (data.type === 'snapshot' && data.snapshot && !isAuthority) {
            applySnapshot(data.snapshot);
        }
        else if (data.type === 'pause') {
            isPaused = true;
        }
        else if (data.type === 'resume') {
            isPaused = false;
            lastTime = performance.now();
        }
    });

    /**
     * Authority-side restore: apply a full live snapshot to bring the sim to the
     * exact state it was in when the game was paused. Called only on authority.
     */
    function applyLiveSnapshotAsAuthority(snap) {
        if (!snap || !isAuthority) return;

        // Prevent the loadLevel-triggered snapshot from firing (we'll send our own below)
        pendingLevelSnapshot = false;

        // Restore RNG + tick state
        if (typeof snap.rngState === 'number') BreakOut.setRngState(snap.rngState);
        if (typeof snap.tick === 'number') tick = snap.tick;
        if (typeof snap.timer === 'number') BreakOut.timer = snap.timer;

        // Restore scores
        if (snap.scores) {
            if (typeof snap.scores.A === 'number') BreakOut.score.A = snap.scores.A;
            if (typeof snap.scores.B === 'number') BreakOut.score.B = snap.scores.B;
        }

        // Restore level bookkeeping
        if (typeof snap.currentLevel === 'number') BreakOut.currentLevel = snap.currentLevel;
        if (typeof snap.levelsCompleted === 'number') levelsCompleted = snap.levelsCompleted;

        // Restore bricks (clear then place from snapshot)
        clearAllBricks();
        if (snap.bricks && snap.bricks.length > 0) {
            placeBricksFromSnapshot(snap.bricks);
        }

        // Restore bonuses
        clearAllBonuses();
        if (snap.bonuses && snap.bonuses.length > 0) {
            for (var i = 0; i < snap.bonuses.length; i++) {
                var sb = snap.bonuses[i];
                var created = createBonusFromPick(sb.type);
                created.mpType = sb.type;
                created.spawnX = sb.spawnX;
                created.spawnY = sb.spawnY;
                created.init();
                created.add();
                created.object.position.x = sb.x;
                created.object.position.y = sb.y;
                created.team = sb.team || '';
                created.object.visible = true;
            }
        }

        // Restore paddles
        if (snap.paddles) {
            if (snap.paddles.A && playerA) playerA.object.position.x = clampPaddleX(snap.paddles.A.x);
            if (snap.paddles.B && playerB) playerB.object.position.x = clampPaddleX(snap.paddles.B.x);
        }

        // Restore balls
        if (snap.balls) {
            for (var bi = 0; bi < snap.balls.length; bi++) {
                var ballData = snap.balls[bi];
                var pl = getPlayerByTeam(ballData.team);
                if (pl) applyBallFromSnapshot(pl, ballData);
            }
        }

        // Authority sends the corrected state to peer immediately
        sendSnapshot();
    }


    function sendPaddle(paddleTick, x, shoot) {
        window.parent.postMessage({
            source: "playground-legacy-game",
            gameKey: "breakout",
            type: "paddle",
            paddle: {
                seat: mySeat,
                tick: paddleTick,
                x: x,
                shoot: shoot
            }
        }, window.location.origin);
    }

    function postEnd(result) {
        if (!isAuthority) return;
        window.parent.postMessage({
            source: "playground-legacy-game",
            gameKey: "breakout",
            type: "end",
            result: result
        }, window.location.origin);
    }

    function captureSnapshot() {
        var balls = [];
        for (var i = 0; i < BreakOut.players.length; i++) {
            var ball = ownedBallsByTeam[BreakOut.players[i].team] || BreakOut.players[i].element.ball;
            if (!ball) continue;
            BreakOut.players[i].element.ball = ball;
            balls.push({
                team: BreakOut.players[i].team,
                x: ball.object.position.x,
                y: ball.object.position.y,
                vx: ball.stats.speed.x,
                vy: ball.stats.speed.y,
                prevX: ball.prevPosition.x,
                prevY: ball.prevPosition.y,
                attached: ball.attachtTo !== '' && ball.attachtTo != null,
                attachedTeam: ball.attachtTo && ball.attachtTo.team ? ball.attachtTo.team : BreakOut.players[i].team,
                attachX: ball.attachtToPos.x,
                attachY: ball.attachtToPos.y,
                hasFire: ball.hasFire,
                maxSpeed: ball.stats.maxSpeed
            });
        }

        var bricks = [];
        for (var j = 0; j < BreakOut.objects.length; j++) {
            var obj = BreakOut.objects[j];
            if (obj.name === 'brick' && obj.object.visible) {
                bricks.push({
                    x: obj.object.position.x,
                    y: obj.object.position.y,
                    texIdx: getBrickTexIdx(obj),
                    brickKey: getBrickTypeKey(obj)
                });
            }
        }

        var bonuses = [];
        for (var k = 0; k < BreakOut.objects.length; k++) {
            var bonus = BreakOut.objects[k];
            if (bonus.name === 'bonus' && bonus.object.visible) {
                bonuses.push({
                    x: bonus.object.position.x,
                    y: bonus.object.position.y,
                    spawnX: bonus.spawnX,
                    spawnY: bonus.spawnY,
                    type: bonus.mpType || 'bonus-coin',
                    team: bonus.team || ''
                });
            }
        }

        return {
            kind: 'snapshot',
            tick: tick,
            rngState: BreakOut.getRngState(),
            timer: BreakOut.timer,
            currentLevel: BreakOut.currentLevel,
            levelsCompleted: levelsCompleted,
            scores: { A: BreakOut.score.A, B: BreakOut.score.B },
            balls: balls,
            paddles: {
                A: { x: playerA ? playerA.object.position.x : 0 },
                B: { x: playerB ? playerB.object.position.x : 0 }
            },
            bricks: bricks,
            bonuses: bonuses
        };
    }

    function sendSnapshot() {
        if (!isAuthority) return;
        window.parent.postMessage({
            source: "playground-legacy-game",
            gameKey: "breakout",
            type: "snapshot",
            snapshot: captureSnapshot()
        }, window.location.origin);
    }

    function syncBricksFromSnapshot(snap) {
        var snapBrickKeys = {};
        for (var si = 0; si < snap.bricks.length; si++) {
            snapBrickKeys[brickPosKey(snap.bricks[si].x, snap.bricks[si].y)] = snap.bricks[si];
        }

        var toRemove = [];
        for (var oi = 0; oi < BreakOut.objects.length; oi++) {
            var brickObj = BreakOut.objects[oi];
            if (brickObj.name === 'brick' && brickObj.object.visible) {
                var key = brickPosKey(brickObj.object.position.x, brickObj.object.position.y);
                if (!snapBrickKeys[key]) {
                    toRemove.push(brickObj);
                }
            }
        }
        for (var ri = 0; ri < toRemove.length; ri++) {
            silentRemove(toRemove[ri]);
        }

        for (var key in snapBrickKeys) {
            if (!snapBrickKeys.hasOwnProperty(key)) continue;
            var sb = snapBrickKeys[key];
            var existing = findBrickAt(sb.x, sb.y);
            if (existing && getBrickTypeKey(existing) !== (sb.brickKey || 'brick')) {
                silentRemove(existing);
                existing = null;
            }
            if (existing) {
                setBrickTexIdx(existing, sb.texIdx);
            } else {
                var newBrick = createBrickByKey(sb.brickKey || 'brick');
                newBrick.init();
                newBrick.add();
                newBrick.object.position.x = sb.x;
                newBrick.object.position.y = sb.y;
                setBrickTexIdx(newBrick, sb.texIdx);
            }
        }

        var brickCount = 0;
        for (var ci = 0; ci < BreakOut.objects.length; ci++) {
            if (BreakOut.objects[ci].name === 'brick' && BreakOut.objects[ci].object.visible) {
                brickCount++;
            }
        }
        BreakOut.totalBricks = brickCount;
    }

    function applySnapshot(snap) {
        if (isAuthority || !snap) return;
        if (typeof snap.tick === 'number' && lastCorrectedSnap && snap.tick < lastCorrectedSnap.tick) {
            return;
        }

        var levelChanged = snap.currentLevel !== BreakOut.currentLevel
            || (snap.levelsCompleted || 0) !== levelsCompleted;

        BreakOut.setRngState(snap.rngState);
        tick = snap.tick;
        BreakOut.timer = snap.timer;
        levelsCompleted = snap.levelsCompleted || 0;
        BreakOut.currentLevel = snap.currentLevel;
        BreakOut.score.A = snap.scores.A;
        BreakOut.score.B = snap.scores.B;

        if (levelChanged) {
            clearAllBonuses();
            clearAllBricks();
            placeBricksFromSnapshot(snap.bricks || []);
            levelStartShootLock = 45;
            clearShootInput();
        } else {
            syncBricksFromSnapshot(snap);
        }

        correctBonusesFromSnapshot(snap);

        lastCorrectedSnap = JSON.parse(JSON.stringify(snap));
        reapplyBallsFromCorrectedSnap();
        ballCorrectionHold = 2;

        if (snap.paddles) {
            if (mySeat !== 'A' && snap.paddles.A && playerA) {
                playerA.object.position.x = clampPaddleX(snap.paddles.A.x);
                remotePaddleX.A = snap.paddles.A.x;
            }
            if (mySeat !== 'B' && snap.paddles.B && playerB) {
                playerB.object.position.x = clampPaddleX(snap.paddles.B.x);
                remotePaddleX.B = snap.paddles.B.x;
            }
        }
    }

    const activeKeys = {};
    window.addEventListener('keydown', function(e) {
        activeKeys[e.key] = true;
        isUsingMouse = false;
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

    let localMouseX = null;
    let localShootPressed = false;
    document.body.addEventListener('mousemove', function(e) {
        document.body.style.cursor = 'default';
        clearTimeout(mouseHideTimeOut);
        mouseHideTimeOut = setTimeout(hideCursor, 2000);
        var scaleX = BreakOut.settings.width / (window.innerWidth || 1);
        localMouseX = e.clientX * scaleX;
        isUsingMouse = true;
    });
    document.body.addEventListener('click', function() {
        localShootPressed = true;
    });

    let accumulator = 0;
    let lastTime = 0;
    const dt = 1000 / 60;

    function tickLoop(timestamp) {
        if (!isStarted) return;
        if (isPaused) {
            requestAnimationFrame(tickLoop);
            return;
        }
        if (!lastTime) lastTime = timestamp;
        let elapsed = timestamp - lastTime;
        lastTime = timestamp;
        if (elapsed > 100) elapsed = 100;

        accumulator += elapsed;
        while (accumulator >= dt) {
            stepSimulation();
            accumulator -= dt;
        }

        renderer.render(stage);
        requestAnimationFrame(tickLoop);
    }

    function applyPartnerPaddle() {
        if (mySeat !== 'A' && remotePaddleX.A != null && playerA) {
            playerA.object.position.x = clampPaddleX(remotePaddleX.A);
        }
        if (mySeat !== 'B' && remotePaddleX.B != null && playerB) {
            playerB.object.position.x = clampPaddleX(remotePaddleX.B);
        }
    }

    function applyLocalPaddle() {
        const myPaddle = getPaddleForSeat(mySeat);
        if (!myPaddle) return;

        if (isUsingMouse && localMouseX !== null) {
            myPaddle.object.position.x = clampPaddleX(localMouseX);
        } else if (activeKeys['ArrowLeft'] || activeKeys['a'] || activeKeys['A']) {
            myPaddle.object.position.x = clampPaddleX(myPaddle.object.position.x - 8);
        } else if (activeKeys['ArrowRight'] || activeKeys['d'] || activeKeys['D']) {
            myPaddle.object.position.x = clampPaddleX(myPaddle.object.position.x + 8);
        }

        let localShoot = false;
        if (levelStartShootLock > 0) {
            levelStartShootLock--;
        } else if (activeKeys[' '] || activeKeys['ArrowUp'] || activeKeys['w'] || activeKeys['W'] || localShootPressed) {
            localShoot = true;
            myPaddle.shoot();
            activeKeys[' '] = false;
            activeKeys['ArrowUp'] = false;
            activeKeys['w'] = false;
            activeKeys['W'] = false;
            localShootPressed = false;
        }

        sendPaddle(tick, myPaddle.object.position.x, localShoot);
    }

    function stepSimulation() {
        applyPartnerPaddle();
        applyLocalPaddle();

        BreakOut.update(16.666);

        if (!isAuthority && ballCorrectionHold > 0) {
            reapplyBallsFromCorrectedSnap();
            ballCorrectionHold--;
        }

        if (BreakOut.score.A <= -500 || BreakOut.score.B <= -500) {
            isStarted = false;
            postEnd("lost");
            return;
        }

        tick++;

        if (isAuthority) {
            if (pendingLevelSnapshot) {
                pendingLevelSnapshot = false;
                sendSnapshot();
            } else if (tick % SNAPSHOT_INTERVAL === 0) {
                sendSnapshot();
            }
        }
    }
})();
