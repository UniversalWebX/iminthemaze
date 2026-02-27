const socket = io();
const gCanvas = document.getElementById('gameCanvas');
const eCanvas = document.getElementById('editorCanvas');
const gCtx = gCanvas.getContext('2d');
const eCtx = eCanvas.getContext('2d');
[gCanvas, eCanvas].forEach(c => { c.width = 1200; c.height = 800; });

let mapData = {}, editorData = {}, currentTool = 'wall', selectedId = null, isDragging = false;
let player = { x: 0, y: 0, visualX: 0, visualY: 0, inventory: [], radius: 12 };
let otherPlayers = {};

function switchTab(t) {
    document.querySelectorAll('.view, .tab').forEach(el => el.classList.remove('active'));
    document.getElementById('view-'+t).classList.add('active');
    event.currentTarget.classList.add('active');
}

// --- AI & EDITOR ---
function askAI() {
    const p = document.getElementById('aiPrompt').value;
    if (!p) return;
    socket.emit('askAI', p);
    document.getElementById('aiPrompt').value = "Generating...";
}

socket.on('aiResponse', data => {
    editorData = data;
    drawEditor();
    document.getElementById('aiPrompt').value = "";
});

function setTool(t, btn) {
    currentTool = t;
    document.querySelectorAll('.tool').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

eCanvas.addEventListener('mousedown', e => {
    const rect = eCanvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left)/20)*20;
    const y = Math.floor((e.clientY - rect.top)/20)*20;
    
    if (currentTool === 'delete') {
        const id = Object.keys(editorData).find(k => x >= editorData[k].x && x < editorData[k].x + editorData[k].w && y >= editorData[k].y && y < editorData[k].y + editorData[k].h);
        if (id) delete editorData[id];
    } else if (currentTool === 'select') {
        selectedId = Object.keys(editorData).find(k => x >= editorData[k].x && x < editorData[k].x + editorData[k].w && y >= editorData[k].y && y < editorData[k].y + editorData[k].h);
    } else {
        const id = `obj_${Date.now()}`;
        editorData[id] = { type: currentTool, x, y, w: 20, h: 20, color: getToolColor(currentTool) };
    }
    isDragging = true;
    drawEditor();
});

function getToolColor(t) {
    return { wall: "#5dade2", door: "#e67e22", key: "#f1c40f", start: "#27ae60", end: "#e74c3c" }[t] || "#fff";
}

function drawEditor() {
    eCtx.fillStyle = "#000"; eCtx.fillRect(0,0,1200,800);
    Object.values(editorData).forEach(o => {
        eCtx.fillStyle = o.color;
        eCtx.fillRect(o.x, o.y, o.w, o.h);
    });
}

function copyCode() {
    const code = JSON.stringify(editorData);
    navigator.clipboard.writeText(code);
    document.getElementById('mazeInput').value = code;
    alert("Code Copied!");
}

// --- GAMEPLAY ---
window.addEventListener('keydown', e => {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
    let nx = player.x, ny = player.y;
    const k = e.key.toLowerCase();
    if (k === 'w') ny -= 8; if (k === 's') ny += 8; if (k === 'a') nx -= 8; if (k === 'd') nx += 8;

    let col = false;
    for (let id in mapData) {
        let o = mapData[id];
        if (o.type === 'wall') {
            let cx = Math.max(o.x, Math.min(nx, o.x + o.w)), cy = Math.max(o.y, Math.min(ny, o.y + o.h));
            if ((nx-cx)**2 + (ny-cy)**2 < player.radius**2) { col = true; break; }
        }
    }
    if (!col) { player.x = nx; player.y = ny; socket.emit('move', {x: nx, y: ny}); }
});

function hostMaze() {
    const code = document.getElementById('mazeInput').value;
    const room = document.getElementById('roomName').value;
    if (code && room) {
        socket.emit('createRoom', { roomName: room, mapData: JSON.parse(code) });
        joinRoom(room);
    }
}

function joinRoom(n) {
    socket.emit('joinRoom', { roomName: n, username: document.getElementById('username').value });
    document.getElementById('overlay').style.display = 'none';
}

socket.on('mapUpdate', d => { 
    mapData = d; 
    const start = Object.values(d).find(o => o.type === 'start');
    if (start) { player.x = player.visualX = start.x+20; player.y = player.visualY = start.y+20; }
});

socket.on('state', s => otherPlayers = s);

function draw() {
    gCtx.fillStyle = "#0d0d0d"; gCtx.fillRect(0,0,1200,800);
    player.visualX += (player.x - player.visualX) * 0.2;
    player.visualY += (player.y - player.visualY) * 0.2;
    Object.values(mapData).forEach(o => { gCtx.fillStyle = o.color; gCtx.fillRect(o.x, o.y, o.w, o.h); });
    gCtx.fillStyle = "#00ffcc"; gCtx.beginPath(); gCtx.arc(player.visualX, player.visualY, 12, 0, 7); gCtx.fill();
    requestAnimationFrame(draw);
}
draw();
