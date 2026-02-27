const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const socket = io();
canvas.width = 1200;
canvas.height = 800;

let mapData = {};
let player = { x: 100, y: 100, visualX: 100, visualY: 100, color: '#00ffcc', radius: 10, inventory: [] };
let otherPlayers = {};

const icons = { door: "🚪", portal: "🌀", key: "🔑", start: "🏠", end: "🏆" };

// --- LOGIC ---

socket.on('mapUpdate', (data) => { 
    mapData = data; 
    for (let id in mapData) {
        if (mapData[id].type === 'start') {
            player.x = player.visualX = mapData[id].x + (mapData[id].w / 2);
            player.y = player.visualY = mapData[id].y + (mapData[id].h / 2);
            break;
        }
    }
});

socket.on('state', (players) => { otherPlayers = players; });

window.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT') return;
    let nx = player.x, ny = player.y;
    const key = e.key.toLowerCase();
    
    if (key === 'w') ny -= 7;
    if (key === 's') ny += 7;
    if (key === 'a') nx -= 7;
    if (key === 'd') nx += 7;

    let collision = false;
    for (let id in mapData) {
        let o = mapData[id];
        
        // Wall Collision
        if (o.type === 'wall') {
            let cx = Math.max(o.x, Math.min(nx, o.x + o.w));
            let cy = Math.max(o.y, Math.min(ny, o.y + o.h));
            if ((nx - cx)**2 + (ny - cy)**2 < player.radius**2) { collision = true; break; }
        }

        // Door ID Logic
        if (o.type === 'door') {
            let cx = Math.max(o.x, Math.min(nx, o.x + o.w));
            let cy = Math.max(o.y, Math.min(ny, o.y + o.h));
            if ((nx - cx)**2 + (ny - cy)**2 < player.radius**2) {
                if (player.inventory.includes(o.linkId)) {
                    delete mapData[id]; // Open Door
                } else {
                    collision = true; // Locked
                }
            }
        }

        // Key Pickup Logic
        if (o.type === 'key') {
            let dist = Math.sqrt((nx - (o.x + o.w/2))**2 + (ny - (o.y + o.h/2))**2);
            if (dist < 20) {
                player.inventory.push(o.linkId);
                delete mapData[id];
                console.log("Picked up key:", o.linkId);
            }
        }

        // Portal ID Logic (Teleport to Portal with same ID)
        if (o.type === 'portal') {
            let dist = Math.sqrt((nx - (o.x + o.w/2))**2 + (ny - (o.y + o.h/2))**2);
            if (dist < 15) {
                for (let otherId in mapData) {
                    let p2 = mapData[otherId];
                    if (p2.type === 'portal' && p2.linkId === o.linkId && otherId !== id) {
                        nx = player.x = player.visualX = p2.x + p2.w/2;
                        ny = player.y = player.visualY = p2.y + p2.h/2;
                        break;
                    }
                }
            }
        }
    }

    if (!collision) {
        player.x = nx; player.y = ny;
        socket.emit('move', { x: player.x, y: player.y });
    }
});

// --- DRAW ---

function draw() {
    ctx.fillStyle = "#0d0d0d"; ctx.fillRect(0, 0, 1200, 800);
    player.visualX += (player.x - player.visualX) * 0.2;
    player.visualY += (player.y - player.visualY) * 0.2;

    for (let id in mapData) {
        let o = mapData[id];
        ctx.fillStyle = o.color;
        ctx.fillRect(o.x, o.y, o.w, o.h);
        
        if (icons[o.type]) {
            ctx.fillStyle = "white";
            ctx.font = `${o.w * 0.7}px Arial`;
            ctx.textAlign = "center";
            ctx.fillText(icons[o.type], o.x + o.w/2, o.y + o.h*0.8);
        }
    }

    // Other Players
    for (let id in otherPlayers) {
        if (id === socket.id) continue;
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.beginPath(); ctx.arc(otherPlayers[id].x, otherPlayers[id].y, 10, 0, Math.PI*2); ctx.fill();
    }

    // Local Player
    ctx.fillStyle = player.color;
    ctx.beginPath(); ctx.arc(player.visualX, player.visualY, 10, 0, Math.PI*2); ctx.fill();
    requestAnimationFrame(draw);
}
draw();
