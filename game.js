const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const socket = io();

// Game State
let mapData = {};
let player = { 
    x: 100, 
    y: 100, 
    visualX: 100, 
    visualY: 100, 
    color: '#00ffcc', 
    username: 'Player', 
    keys: [], 
    radius: 10 
};
let otherPlayers = {};

// --- SOCKET CONFIG ---

socket.on('roomList', (list) => {
    const listDiv = document.getElementById('roomList');
    if (!listDiv) return;
    listDiv.innerHTML = "";
    list.forEach(name => {
        let div = document.createElement('div');
        div.className = 'room-item';
        div.innerText = "Join: " + name;
        div.onclick = () => joinRoom(name);
        listDiv.appendChild(div);
    });
});

socket.on('mapUpdate', (data) => {
    mapData = data;
    // Set Canvas Size based on maze bounds
    let maxX = 800, maxY = 600;
    for (let id in mapData) {
        let o = mapData[id];
        if (o.x + o.w > maxX) maxX = o.x + o.w + 100;
        if (o.y + o.h > maxY) maxY = o.y + o.h + 100;
        
        // Auto-spawn player at 'START'
        if (o.type === 'start') {
            player.x = player.visualX = o.x + o.w / 2;
            player.y = player.visualY = o.y + o.h / 2;
        }
    }
    canvas.width = maxX;
    canvas.height = maxY;
});

socket.on('state', (players) => {
    otherPlayers = players;
});

// --- RENDERING ENGINE ---

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#121212";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Maze Objects
    for (let id in mapData) {
        let obj = mapData[id];
        ctx.save();
        
        // Handle Rotations & Positioning
        ctx.translate(obj.x + obj.w / 2, obj.y + obj.h / 2);
        ctx.rotate((obj.rot * Math.PI) / 180);
        
        ctx.fillStyle = obj.color;
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        
        if (obj.type === 'wall' || obj.type === 'door') {
            ctx.fillRect(-obj.w / 2, -obj.h / 2, obj.w, obj.h);
            ctx.strokeRect(-obj.w / 2, -obj.h / 2, obj.w, obj.h);
            
            // Visual for Doors (Iron Bars)
            if (obj.type === 'door') {
                ctx.fillStyle = "rgba(0,0,0,0.5)";
                for (let i = -obj.w / 2 + 5; i < obj.w / 2; i += 10) {
                    ctx.fillRect(i, -obj.h / 2, 2, obj.h);
                }
            }
        } else if (obj.type === 'portal') {
            ctx.strokeStyle = obj.color;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.ellipse(0, 0, obj.w / 2, obj.h / 2, 0, 0, Math.PI * 2);
            ctx.stroke();
        } else if (obj.type === 'key') {
            ctx.fillStyle = obj.color;
            ctx.beginPath();
            ctx.arc(0, -obj.h / 4, obj.w / 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(-2, -obj.h / 4, 4, obj.h / 2);
        }

        ctx.restore();
    }

    // 2. Draw Other Players
    for (let id in otherPlayers) {
        if (id === socket.id) continue;
        let p = otherPlayers[id];
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, player.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Username Label
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = "white";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(p.username || "Guest", p.x, p.y - 15);
    }

    // 3. Local Player Smooth Movement
    player.visualX += (player.x - player.visualX) * 0.25;
    player.visualY += (player.y - player.visualY) * 0.25;

    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(player.visualX, player.visualY, player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.stroke();

    requestAnimationFrame(draw);
}

// --- CONTROLS & COLLISION ---

window.addEventListener('keydown', (e) => {
    // Ignore movement if typing in chat
    if (document.activeElement.tagName === 'INPUT') return;

    let moveSpeed = 8;
    let nx = player.x;
    let ny = player.y;
    const key = e.key.toLowerCase();

    // WASD Bindings
    if (key === 'w') ny -= moveSpeed;
    if (key === 's') ny += moveSpeed;
    if (key === 'a') nx -= moveSpeed;
    if (key === 'd') nx += moveSpeed;

    // Advanced Circle-to-Rectangle Collision
    let collision = false;
    for (let id in mapData) {
        let o = mapData[id];
        
        // Only collide with Walls and Doors
        if (o.type === 'wall' || o.type === 'door') {
            // Find the closest point on the rectangle to the player center
            let closestX = Math.max(o.x, Math.min(nx, o.x + o.w));
            let closestY = Math.max(o.y, Math.min(ny, o.y + o.h));

            let distanceX = nx - closestX;
            let distanceY = ny - closestY;
            let distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);

            if (distanceSquared < (player.radius * player.radius)) {
                collision = true;
                break;
            }
        }
        
        // Trigger Events (Keys / Portals)
        if (o.type === 'key' || o.type === 'portal' || o.type === 'end') {
            let distX = nx - (o.x + o.w/2);
            let distY = ny - (o.y + o.h/2);
            if (Math.sqrt(distX*distX + distY*distY) < 20) {
                handleTrigger(id, o);
            }
        }
    }

    if (!collision) {
        player.x = nx;
        player.y = ny;
        socket.emit('move', { x: player.x, y: player.y, username: player.username, color: player.color });
    }
});

function handleTrigger(id, obj) {
    if (obj.type === 'key') {
        player.keys.push(id);
        delete mapData[id]; // Pick up key
    } else if (obj.type === 'end') {
        alert("🎉 Maze Escaped!");
        location.reload();
    }
}

// Start Render Loop
draw();
