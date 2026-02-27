const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const socket = io(); 

canvas.width = 1200;
canvas.height = 800;

let mapData = {};
let player = { x: 100, y: 100, visualX: 100, visualY: 100, color: '#00ffcc', radius: 12, inventory: [] };
let otherPlayers = {};
const icons = { door: "🚪", portal: "🌀", key: "🔑", start: "🏠", end: "🏆" };

// --- ROOM MANAGEMENT ---

function hostMaze() {
    const raw = document.getElementById('mazeInput').value;
    const room = document.getElementById('roomName').value;
    const user = document.getElementById('username').value || "Host";

    if (!raw || !room) return alert("Missing data!");
    try {
        const parsed = JSON.parse(raw);
        socket.emit('createRoom', { roomName: room, mapData: parsed });
        
        // AUTO-JOIN Logic
        setTimeout(() => {
            joinRoom(room);
        }, 100); 
    } catch(e) { alert("Invalid Maze Code!"); }
}

function joinRoom(name) {
    const user = document.getElementById('username').value || "Player";
    socket.emit('joinRoom', { roomName: name, username: user, color: player.color });
    document.getElementById('setup-ui').style.display = 'none';
}

socket.on('roomList', (list) => {
    const listDiv = document.getElementById('roomList');
    if (!listDiv) return;
    listDiv.innerHTML = "";
    if (list.length === 0) {
        listDiv.innerHTML = '<span style="color: #555; font-size: 12px;">Searching for live games...</span>';
    }
    list.forEach(name => {
        const b = document.createElement('button');
        b.innerText = "Join " + name;
        b.className = "join-btn";
        b.onclick = () => joinRoom(name);
        listDiv.appendChild(b);
    });
});

socket.on('mapUpdate', (data) => { 
    mapData = data; 
    for (let id in mapData) {
        if (mapData[id].type === 'start') {
            player.x = player.visualX = mapData[id].x + (mapData[id].w / 2);
            player.y = player.visualY = mapData[id].y + (mapData[id].h / 2);
            socket.emit('move', {x: player.x, y: player.y});
            break;
        }
    }
});

socket.on('state', (players) => { otherPlayers = players; });

// --- INTERACTION & MOVEMENT ---

window.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT') return;
    let nx = player.x, ny = player.y;
    const key = e.key.toLowerCase();
    
    // WASD Movement
    if (key === 'w') ny -= 8;
    if (key === 's') ny += 8;
    if (key === 'a') nx -= 8;
    if (key === 'd') nx += 8;

    let collision = false;
    for (let id in mapData) {
        let o = mapData[id];
        
        if (o.type === 'wall' || o.type === 'door') {
            let cx = Math.max(o.x, Math.min(nx, o.x + o.w));
            let cy = Math.max(o.y, Math.min(ny, o.y + o.h));
            if ((nx - cx)**2 + (ny - cy)**2 < player.radius**2) {
                if (o.type === 'door' && player.inventory.includes(o.linkId)) {
                    delete mapData[id]; 
                } else {
                    collision = true; break;
                }
            }
        }

        let dist = Math.sqrt((nx - (o.x + o.w/2))**2 + (ny - (o.y + o.h/2))**2);
        if (dist < 20) {
            if (o.type === 'key') {
                player.inventory.push(o.linkId);
                delete mapData[id];
            }
            if (o.type === 'portal') {
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
            ctx.font = "20px Arial";
            ctx.textAlign = "center";
            ctx.fillText(icons[o.type], o.x + o.w/2, o.y + o.h*0.7);
        }
    }

    for (let id in otherPlayers) {
        if (id === socket.id) continue;
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.beginPath(); ctx.arc(otherPlayers[id].x, otherPlayers[id].y, 10, 0, Math.PI*2); ctx.fill();
    }

    ctx.fillStyle = player.color;
    ctx.beginPath(); ctx.arc(player.visualX, player.visualY, 12, 0, Math.PI*2); ctx.fill();
    requestAnimationFrame(draw);
}
draw();
