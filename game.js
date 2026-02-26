const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const socket = io();

let mapData = {};
let player = { x: 50, y: 50, visualX: 50, visualY: 50, color: '#00ffcc', username: '', keys: [] };
let otherPlayers = {};

// Handle map updates from Python/Server
socket.on('mapUpdate', (data) => {
    mapData = data;
    // Find start point
    for (let id in mapData) {
        if (mapData[id].type === 'start') {
            player.x = player.visualX = mapData[id].x;
            player.y = player.visualY = mapData[id].y;
            break;
        }
    }
});

socket.on('state', (players) => { otherPlayers = players; });

function draw() {
    ctx.fillStyle = "#121212";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Smooth movement interpolation
    player.visualX += (player.x - player.visualX) * 0.2;
    player.visualY += (player.y - player.visualY) * 0.2;

    // Draw Objects (Walls, Doors, etc.)
    for (let id in mapData) {
        let obj = mapData[id];
        ctx.save();
        ctx.translate(obj.x + obj.w/2, obj.y + obj.h/2);
        ctx.rotate((obj.rot * Math.PI) / 180);
        
        ctx.fillStyle = obj.color;
        if (obj.type === 'wall' || obj.type === 'door') {
            ctx.fillRect(-obj.w/2, -obj.h/2, obj.w, obj.h);
            if(obj.type === 'door') {
                ctx.fillStyle = "rgba(0,0,0,0.4)";
                ctx.fillRect(-obj.w/2 + 5, -obj.h/2, 5, obj.h);
            }
        } else if (obj.type === 'portal') {
            ctx.strokeStyle = obj.color; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.ellipse(0, 0, obj.w/2, obj.h/2, 0, 0, Math.PI*2); ctx.stroke();
        }
        ctx.restore();
    }

    // Draw Players
    for (let id in otherPlayers) {
        if (id === socket.id) continue;
        let p = otherPlayers[id];
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI*2); ctx.fill();
    }

    ctx.fillStyle = player.color;
    ctx.beginPath(); ctx.arc(player.visualX, player.visualY, 10, 0, Math.PI*2); ctx.fill();

    requestAnimationFrame(draw);
}

// WASD MOVEMENT with Box Collision
window.addEventListener('keydown', (e) => {
    if(document.activeElement.tagName === 'INPUT') return;

    let moveSpeed = 8;
    let nx = player.x, ny = player.y;
    const key = e.key.toLowerCase();

    if (key === 'w') ny -= moveSpeed;
    if (key === 's') ny += moveSpeed;
    if (key === 'a') nx -= moveSpeed;
    if (key === 'd') nx += moveSpeed;

    // Basic Bounding Box Collision
    let collision = false;
    for (let id in mapData) {
        let o = mapData[id];
        if (o.type === 'wall' || o.type === 'door') {
            if (nx + 10 > o.x && nx - 10 < o.x + o.w &&
                ny + 10 > o.y && ny - 10 < o.y + o.h) {
                collision = true;
            }
        }
    }

    if (!collision) {
        player.x = nx;
        player.y = ny;
        socket.emit('move', { x: player.x, y: player.y });
    }
});

draw();
