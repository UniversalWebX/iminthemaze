const socket = io();

const gCanvas = document.getElementById('gameCanvas');
const eCanvas = document.getElementById('editorCanvas');
const gCtx = gCanvas.getContext('2d');
const eCtx = eCanvas.getContext('2d');

[gCanvas, eCanvas].forEach(c => {
    c.width = 1200;
    c.height = 800;
});

let mapData = {};
let editorData = {};
let currentTool = 'select';
let isMouseDown = false;

let player = {
    x: 0,
    y: 0,
    visualX: 0,
    visualY: 0,
    mode: 'normal',
    color: '#00ffcc'
};

let otherPlayers = {};
let keys = {};

function tab(t) {
    document.querySelectorAll('.view, .tab').forEach(el => el.classList.remove('active'));
    document.getElementById('view-' + t).classList.add('active');
    event.currentTarget.classList.add('active');
}

function setTool(t, btn) {
    currentTool = t;
    document.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

// ────────────────────────────────────────────────
// EDITOR
// ────────────────────────────────────────────────

function handleEdit(e) {
    const rect = eCanvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / 20) * 20;
    const y = Math.floor((e.clientY - rect.top) / 20) * 20;

    const idAt = Object.keys(editorData).find(k => {
        const o = editorData[k];
        return x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h;
    });

    if (currentTool === 'draw' && isMouseDown) {
        if (!idAt) {
            editorData[`w_${x}_${y}`] = {
                type: 'wall',
                x, y,
                w: 20, h: 20,
                color: '#5dade2',
                rot: 0
            };
        }
    } else if (e.type === 'mousedown') {
        if (currentTool === 'delete' && idAt) {
            delete editorData[idAt];
        }
        if (currentTool === 'rot' && idAt) {
            editorData[idAt].rot = (editorData[idAt].rot + 90) % 360;
        }
        if (['wall','door','key','portal','start','end'].includes(currentTool)) {
            editorData[`obj_${Date.now()}`] = {
                type: currentTool,
                x, y,
                w: 20, h: 20,
                color: getCol(currentTool),
                rot: 0
            };
        }
    }

    drawEditor();
}

function getCol(t) {
    return {
        wall:   "#5dade2",
        door:   "#e67e22",
        key:    "#f1c40f",
        portal: "#9b59b6",
        start:  "#00ff00",
        end:    "#ff0000"
    }[t] || "#888";
}

eCanvas.addEventListener('mousedown', e => { isMouseDown = true; handleEdit(e); });
eCanvas.addEventListener('mousemove',   e => { if (isMouseDown) handleEdit(e); });
window.addEventListener('mouseup',      () => isMouseDown = false);

function drawEditor() {
    eCtx.fillStyle = "#000";
    eCtx.fillRect(0, 0, 1200, 800);

    Object.values(editorData).forEach(o => {
        eCtx.save();
        eCtx.translate(o.x + o.w/2, o.y + o.h/2);
        eCtx.rotate((o.rot || 0) * Math.PI / 180);
        eCtx.fillStyle = o.color;
        eCtx.fillRect(-o.w/2, -o.h/2, o.w, o.h);
        eCtx.restore();
    });
}

// ────────────────────────────────────────────────
// INPUT & WAVE / NORMAL PHYSICS
// ────────────────────────────────────────────────

window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === 'q') {
        player.mode = player.mode === 'wave' ? 'normal' : 'wave';
    }
});

window.addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
});

function wouldCollide(nx, ny) {
    return Object.values(mapData).some(o => {
        if (o.type !== 'wall') return false;

        const cx = o.x + o.w / 2;
        const cy = o.y + o.h / 2;
        const dx = nx - cx;
        const dy = ny - cy;
        const angle = -(o.rot || 0) * Math.PI / 180;

        const lx =  dx * Math.cos(angle) - dy * Math.sin(angle);
        const ly =  dx * Math.sin(angle) + dy * Math.cos(angle);

        return Math.abs(lx) < o.w / 2 && Math.abs(ly) < o.h / 2;
    });
}

function update() {
    let nx = player.x;
    let ny = player.y;
    const speed = 5;

    if (player.mode === 'wave') {
        nx += speed;
        ny += (keys['w'] || keys['a'] || keys['s'] || keys['d']) ? -speed : speed;
    } else {
        if (keys['w']) ny -= speed;
        if (keys['s']) ny += speed;
        if (keys['a']) nx -= speed;
        if (keys['d']) nx += speed;
    }

    const wouldHit = wouldCollide(nx, ny);

    if (wouldHit) {
        if (player.mode === 'wave') {
            const s = Object.values(mapData).find(o => o.type === 'start');
            player.x = player.visualX = s ? s.x + 10 : 10;
            player.y = player.visualY = s ? s.y + 10 : 10;
            socket.emit('move', { x: player.x, y: player.y });
        }
        // normal mode → just don't move
    } else {
        player.x = nx;
        player.y = ny;
        socket.emit('move', { x: player.x, y: player.y });
    }
}

function loop() {
    update();

    gCtx.fillStyle = "#050505";
    gCtx.fillRect(0, 0, 1200, 800);

    Object.values(mapData).forEach(o => {
        gCtx.save();
        gCtx.translate(o.x + o.w/2, o.y + o.h/2);
        gCtx.rotate((o.rot || 0) * Math.PI / 180);
        gCtx.fillStyle = o.color;
        gCtx.fillRect(-o.w/2, -o.h/2, o.w, o.h);
        gCtx.restore();
    });

    player.visualX += (player.x - player.visualX) * 0.2;
    player.visualY += (player.y - player.visualY) * 0.2;

    gCtx.fillStyle = player.color;
    gCtx.beginPath();
    gCtx.arc(player.visualX, player.visualY, 10, 0, Math.PI * 2);
    gCtx.fill();

    // Other players
    for (let id in otherPlayers) {
        let p = otherPlayers[id];
        p.visualX = (p.visualX || p.x) + (p.x - (p.visualX || p.x)) * 0.2;
        p.visualY = (p.visualY || p.y) + (p.y - (p.visualY || p.y)) * 0.2;

        gCtx.fillStyle = p.color;
        gCtx.beginPath();
        gCtx.arc(p.visualX, p.visualY, 10, 0, Math.PI * 2);
        gCtx.fill();
    }

    requestAnimationFrame(loop);
}

loop();

// ────────────────────────────────────────────────
// SOCKET EVENTS
// ────────────────────────────────────────────────

function askAI() {
    const prompt = document.getElementById('aiPrompt').value.trim();
    if (prompt) socket.emit('askAI', prompt);
}

socket.on('aiResponse', d => {
    editorData = d;
    drawEditor();
});

function copyCode() {
    navigator.clipboard.writeText(JSON.stringify(editorData, null, 2))
        .then(() => alert("JSON copied to clipboard!"))
        .catch(() => alert("Copy failed"));
}

function hostMaze() {
    let code = {};
    const input = document.getElementById('mazeInput').value.trim();
    if (input) {
        try { code = JSON.parse(input); } catch {}
    }

    const roomName = document.getElementById('roomName').value.trim() || "Room-" + Date.now().toString(36);
    const username = document.getElementById('username').value.trim() || "Player";

    socket.emit('createRoom', { roomName, mapData: code });
    socket.emit('joinRoom', { roomName, username });

    document.getElementById('play-ui').style.display = 'none';
}

function joinRoom(room) {
    const username = document.getElementById('username').value.trim() || "Player";
    socket.emit('joinRoom', { roomName: room, username });
    document.getElementById('play-ui').style.display = 'none';
}

socket.on('roomList', list => {
    document.getElementById('roomList').innerHTML = list.map(r =>
        `<button class="btn" onclick="joinRoom('${r}')">${r}</button>`
    ).join('');
});

socket.on('mapUpdate', d => {
    mapData = d;
    const s = Object.values(d).find(o => o.type === 'start');
    player.x = player.visualX = s ? s.x + 10 : 10;
    player.y = player.visualY = s ? s.y + 10 : 10;
});

socket.on('state', data => {
    for (let id in data) {
        if (id === socket.id) {
            if (data[id].color) player.color = data[id].color;
            continue;
        }
        if (!otherPlayers[id]) {
            otherPlayers[id] = {
                x: data[id].x,
                y: data[id].y,
                visualX: data[id].x,
                visualY: data[id].y,
                color: data[id].color,
                username: data[id].username
            };
        } else {
            otherPlayers[id].x = data[id].x;
            otherPlayers[id].y = data[id].y;
            otherPlayers[id].color = data[id].color;
            otherPlayers[id].username = data[id].username;
        }
    }

    for (let id in otherPlayers) {
        if (!data[id]) delete otherPlayers[id];
    }
});
