/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 Couchfriends
 * www.couchfriends.com
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */
if (typeof COUCHFRIENDS == 'undefined') {
    console.warn('This game needs the COUCHFRIENDS API included to work.');
}
if (typeof BreakOut == 'undefined') {
    console.warn('This game needs the BreakOut object in order to work.');
}
var renderer, stage, players = [], tmpPlayer = '', mousePos = {
    x: 0,
    y: 0
    }, light = {}, mouseHideTimeOut, sounds = {},
    soundFiles = [], activeKeys = {};

// ---- Solo Full-State Snapshot System ----
// Brick type reverse-map (constructor name -> tile key)
var SOLO_BRICK_TYPE_MAP = {
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

function soloGetBrickTypeKey(brick) {
    if (brick.tileKey) return brick.tileKey;
    var shortName = brick.constructor.name.replace(/^BreakOut\./, '');
    return SOLO_BRICK_TYPE_MAP[shortName] || 'brick';
}

function soloGetBrickTexIdx(brick) {
    var tex = brick.object._originalTexture || brick.object.texture;
    var idx = brick.textures.indexOf(tex);
    return idx < 0 ? brick.textures.length - 1 : idx;
}

function soloCaptureSnapshot() {
    if (!tmpPlayer || tmpPlayer === '') return null;
    var ball = tmpPlayer.ball;
    var ballData = null;
    if (ball) {
        ballData = {
            x: ball.object.position.x,
            y: ball.object.position.y,
            vx: ball.stats ? ball.stats.speed.x : 0,
            vy: ball.stats ? ball.stats.speed.y : 0,
            prevX: ball.prevPosition ? ball.prevPosition.x : ball.object.position.x,
            prevY: ball.prevPosition ? ball.prevPosition.y : ball.object.position.y,
            attached: ball.attachtTo !== '' && ball.attachtTo != null,
            attachX: ball.attachtToPos ? ball.attachtToPos.x : 0,
            attachY: ball.attachtToPos ? ball.attachtToPos.y : 0,
            hasFire: !!ball.hasFire,
            maxSpeed: ball.stats ? ball.stats.maxSpeed : 8
        };
    }

    var bricks = [];
    for (var j = 0; j < BreakOut.objects.length; j++) {
        var obj = BreakOut.objects[j];
        if (obj.name === 'brick' && obj.object.visible) {
            bricks.push({
                x: obj.object.position.x,
                y: obj.object.position.y,
                texIdx: soloGetBrickTexIdx(obj),
                brickKey: soloGetBrickTypeKey(obj)
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
                spawnX: bonus.spawnX || bonus.object.position.x,
                spawnY: bonus.spawnY || bonus.object.position.y,
                type: bonus.mpType || 'bonus-coin'
            });
        }
    }

    // currentLevel was already incremented after loadLevel, so the *playing* level
    // is currentLevel - 1 (wrapping handled). Save the playing level index.
    var playingLevel = BreakOut.currentLevel - 1;
    if (playingLevel < 0) playingLevel = BreakOut.levels.length - 1;

    return {
        kind: 'fullSnapshot',
        currentLevel: playingLevel,
        score: BreakOut.score.A,
        paddleX: tmpPlayer.object ? tmpPlayer.object.position.x : 640,
        ball: ballData,
        bricks: bricks,
        bonuses: bonuses,
        timer: BreakOut.timer
    };
}

function soloSendSnapshot() {
    var snap = soloCaptureSnapshot();
    if (!snap) return;
    window.parent.postMessage({
        source: "playground-legacy-game",
        gameKey: "breakout",
        type: "fullSnapshot",
        snapshot: snap
    }, window.location.origin);
}

// Periodic auto-save every 2 seconds
var soloSnapshotInterval = null;
function soloStartAutoSave() {
    if (soloSnapshotInterval) clearInterval(soloSnapshotInterval);
    soloSnapshotInterval = setInterval(function() {
        soloSendSnapshot();
    }, 2000);
}

// Save on page hide/unload
window.addEventListener('pagehide', function() { soloSendSnapshot(); });
window.addEventListener('beforeunload', function() { soloSendSnapshot(); });

// Listen for restore-snapshot message from parent
window.addEventListener('message', function(event) {
    if (event.origin !== window.location.origin) return;
    var data = event.data;
    if (data && data.source === 'playground-board' && data.gameKey === 'breakout' && data.type === 'restore-snapshot') {
        soloRestoreSnapshot(data.snapshot);
    }
});

// Brick factory for restoring from snapshot (mirrors multiplayer.js createBrickByKey)
function soloCreateBrickByKey(key) {
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
    }
    brick.tileKey = key;
    return brick;
}

function soloSetBrickTexIdx(brick, texIdx) {
    if (typeof brick.textures[texIdx] !== 'undefined') {
        brick.object._originalTexture = brick.textures[texIdx];
        brick.object.texture = brick.textures[texIdx];
    }
}

function soloRestoreSnapshot(snap) {
    if (!snap || !tmpPlayer || tmpPlayer === '') return;

    // Restore score
    if (typeof snap.score === 'number') {
        BreakOut.score.A = snap.score;
        BreakOut.score.B = 0;
    }
    if (typeof snap.timer === 'number') {
        BreakOut.timer = snap.timer;
    }

    // Restore paddle position
    if (typeof snap.paddleX === 'number') {
        tmpPlayer.object.position.x = snap.paddleX;
    }

    // Clear existing bricks
    var toRemove = [];
    for (var i = 0; i < BreakOut.objects.length; i++) {
        if (BreakOut.objects[i].name === 'brick') {
            toRemove.push(BreakOut.objects[i]);
        }
    }
    for (var r = 0; r < toRemove.length; r++) {
        if (toRemove[r].object != null) stage.removeChild(toRemove[r].object);
        var idx = BreakOut.objects.indexOf(toRemove[r]);
        if (idx >= 0) BreakOut.objects.splice(idx, 1);
    }
    BreakOut.totalBricks = 0;

    // Place bricks from snapshot
    if (snap.bricks && snap.bricks.length > 0) {
        for (var b = 0; b < snap.bricks.length; b++) {
            var sb = snap.bricks[b];
            var brick = soloCreateBrickByKey(sb.brickKey || 'brick');
            brick.init();
            brick.add();
            brick.object.position.x = sb.x;
            brick.object.position.y = sb.y;
            soloSetBrickTexIdx(brick, sb.texIdx || 0);
            BreakOut.totalBricks++;
        }
    }

    // Restore ball
    if (snap.ball) {
        var ballData = snap.ball;
        var ball = tmpPlayer.ball;
        if (ball) {
            ball.object.position.x = ballData.x;
            ball.object.position.y = ballData.y;
            if (ball.stats) {
                if (ballData.attached) {
                    ball.attachtTo = tmpPlayer;
                    ball.attachtToPos = { x: ballData.attachX, y: ballData.attachY };
                    tmpPlayer.attachedBalls = [ball];
                    ball.stats.speed.x = 0;
                    ball.stats.speed.y = 0;
                } else {
                    ball.attachtTo = '';
                    ball.stats.speed.x = ballData.vx;
                    ball.stats.speed.y = ballData.vy;
                }
                if (ball.prevPosition) {
                    ball.prevPosition.x = typeof ballData.prevX === 'number' ? ballData.prevX : ballData.x;
                    ball.prevPosition.y = typeof ballData.prevY === 'number' ? ballData.prevY : ballData.y;
                }
                if (typeof ballData.maxSpeed === 'number') ball.stats.maxSpeed = ballData.maxSpeed;
                ball.hasFire = !!ballData.hasFire;
            }
        }
    }
}
// ---- End Solo Snapshot System ----

soundFiles.push(
    {
        key: 'background',
        src: 'Prop - Basic Pleasure.mp3',
        volume: .5,
        loop: true,
        autoplay: true
    },
    {
        key: 'coin',
        src: 'sound-effect-coin.wav'
    },
    {
        key: 'pickup',
        src: 'sound-effect-pickup.mp3',
        volume: 2
    },
    {
        key: 'pickup-wrong',
        src: 'sound-effect-pickup-negative.mp3'
    },
    {
        key: 'explosion',
        src: 'sound-effect-explosion.wav',
        volume: .5
    },
    {
        key: 'shoot',
        src: 'sound-effect-shoot.mp3',
        volume: .2
    },
    {
        key: 'next-level',
        src: 'sound-effect-winner.mp3'
    }
);

function hideCursor() {
    document.body.style.cursor = 'url(assets/empty-cursor.png), auto';
}
window.onload = init;
function init() {

    // Load sound effects
    for (var i = 0; i < soundFiles.length; i++) {
        var sound = soundFiles[i];
        sounds[sound.key] = new Howl(
            {
                src: BreakOut.settings.assetDir + sound.src,
                autoplay: sound.autoplay || false,
                volume: sound.volume || 1,
                loop: sound.loop || false
            }
        )
    }

    mouseHideTimeOut = setTimeout(hideCursor, 2000);
    var w = 1280;
    var h = 720;
    BreakOut.settings.width = w;
    BreakOut.settings.height = h;

    PIXI.scaleModes.DEFAULT = PIXI.scaleModes.NEAREST;
    renderer = new PIXI.lights.WebGLDeferredRenderer(w, h, {transparent: true});

    stage = new PIXI.Container();
    document.getElementById('game').innerHTML = '';
    document.getElementById('game').appendChild(renderer.view);


    if (BreakOut.settings.debug == true) {
        var levels = [];
        levels.push('leveldebug.json');
        for (var i = 0; i < BreakOut.levels.length; i++) {
            levels.push(BreakOut.levels[i]);
        }
        BreakOut.levels = levels;
    }

    BreakOut.init();
    var player = BreakOut.addPlayer('solo-player');
    tmpPlayer = player.element;

    // Send solo-ready AFTER the initial level's AJAX completes (bricks placed)
    // so that restore-snapshot can safely clear and replace those bricks.
    BreakOut.onFirstLevelLoaded = function() {
        soloStartAutoSave();
        window.parent.postMessage({
            source: "playground-legacy-game",
            gameKey: "breakout",
            type: "solo-ready"
        }, window.location.origin);
    };

    BreakOut.loadLevel();

    window.addEventListener('keydown', function (e) {
        activeKeys[e.key] = true;
        if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === 'Spacebar') {
            if (tmpPlayer != '') {
                tmpPlayer.shoot();
            }
        }
    });
    window.addEventListener('keyup', function (e) {
        activeKeys[e.key] = false;
    });

    document.body.addEventListener('mousemove', function (e) {
        document.body.style.cursor = 'default';
        clearTimeout(mouseHideTimeOut);
        mouseHideTimeOut = setTimeout(hideCursor, 2000);
        if (tmpPlayer == '') {
            return;
        }
        var scaleX = BreakOut.settings.width / (window.innerWidth || 1);
        var scaleY = BreakOut.settings.height / (window.innerHeight || 1);
        tmpPlayer.object.position.x = e.clientX * scaleX;
        mousePos.x = e.clientX * scaleX;
        mousePos.y = e.clientY * scaleY;
    });
    document.body.addEventListener('click', function (e) {
        document.body.style.cursor = 'default';
        clearTimeout(mouseHideTimeOut);
        mouseHideTimeOut = setTimeout(hideCursor, 2000);
        if (tmpPlayer != '') {
            tmpPlayer.shoot();
        }
    });
    requestAnimationFrame(update);
}

COUCHFRIENDS.on('connect', function () {
    var jsonData = {
        topic: 'game',
        action: 'host',
        data: {
            sessionKey: 'breakout-1234'
        }
    };
    COUCHFRIENDS.send(jsonData);
});

COUCHFRIENDS.on('player.join', function (data) {
    var player = BreakOut.addPlayer(data.id);
    console.log(player);
    var jsonData = {
        id: data.id,
        topic: 'player',
        action: 'identify',
        type: 'player.identify',
        data: {
            id: data.id,
            color: player.color
        }
    };
    COUCHFRIENDS.send(jsonData);

    var jsonData = {
        id: data.id,
        topic: 'interface',
        action: 'buttonAdd',
        data: {
            playerId: data.id,
            color: '#ff0000',
            id: 'buttonShoot'
        }
    };
    COUCHFRIENDS.send(jsonData);
});

COUCHFRIENDS.on('player.orientation', function (data) {
    var players = BreakOut.players;
    for (var i = 0; i < players.length; i++) {
        if (players[i].id == data.player.id) {
            var x = data.x * 20;
            players[i].element.setSpeed(x);
            return;
        }
    }

});

var shoot = function (data) {
    var playerId = data.player.id;
    var players = BreakOut.players;
    for (var i = 0; i < players.length; i++) {
        if (players[i].id == playerId) {
            players[i].element.shoot();
            return;
        }
    }

};

COUCHFRIENDS.on('button.click', shoot);
COUCHFRIENDS.on('player.clickUp', shoot);
COUCHFRIENDS.on('player.buttonUp', shoot);

function vibrate(team, duration) {
    duration = duration || 200;
    for (var i = 0; i < BreakOut.players.length; i++) {
        if (BreakOut.players[i].team != team) {
            continue;
        }
        var jsonData = {
            topic: 'interface',
            action: 'vibrate',
            type: 'interface.vibrate',
            data: {
                playerId: BreakOut.players[i].id,
                duration: duration
            }
        };
        COUCHFRIENDS.send(jsonData);
    }
}

COUCHFRIENDS.on('player.left', function (data) {
    BreakOut.removePlayer(data.player.id);
});

function update(time) {
    requestAnimationFrame(update);
    if (tmpPlayer != '') {
        var speed = 8;
        if (activeKeys['ArrowLeft'] || activeKeys['a'] || activeKeys['A']) {
            tmpPlayer.object.position.x = Math.max(50, tmpPlayer.object.position.x - speed);
        }
        if (activeKeys['ArrowRight'] || activeKeys['d'] || activeKeys['D']) {
            tmpPlayer.object.position.x = Math.min(BreakOut.settings.width - 50, tmpPlayer.object.position.x + speed);
        }
    }
    BreakOut.update(time);
    renderer.render(stage);
}