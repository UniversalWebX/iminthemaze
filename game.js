const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const socket = io();

let mapData = {};
let player = { x: 100, y: 100, visualX: 100, visualY: 100, color: '#00ffcc', radius: 10 };
let otherPlayers = {};

function hostMaze() {
    const raw = document.getElementById('mazeInput').value;
    const room = document.getElementById('roomName').value;
    if (!raw || !room) return alert("Fill out all fields!");
    socket.emit('createRoom', { roomName: room, mapData: JSON.parse(raw) });
    alert("Room created! You can now join it from the list.");
}

function joinRoom(name) {
    const user = document.getElementById('username').value || "Player";
    socket.emit('joinRoom', { roomName: name, username: user, color: player.color });
    document.getElementById('ui-overlay').style.display = 'none';
}

socket.on('roomList', (list) => {
    const container = document.getElementById('roomList');
    container.innerHTML = "";
    list.forEach(name => {
        const btn = document.createElement('button');
        btn.innerText = "Join " + name;
        btn.onclick = () => joinRoom(name);
        container.appendChild(btn);
    });
});

socket.on('mapUpdate', (data) => { mapData = data; });
socket.on('state', (players) => { otherPlayers = players; });

window.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT') return;
    let nx = player.x, ny = player.y;
    const key = e.key.toLowerCase();
    if (key === 'w') ny -= 7; if (key === 's') ny += 7;
    if (key === 'a') nx -= 7; if (key === 'd') nx += 7;

    let collision = false;
    for (let id in mapData) {
        let o = mapData[id];
        if (o.type === 'wall' || o.type === 'door') {
            let cx = Math.max(o.x, Math.min(nx, o.x + o.w));
            let cy = Math.max(o.y, Math.min(ny, o.y + o.h));
            if ((nx - cx)**2 + (ny - cy)**2 < player.radius**2) { collision = true; break; }
        }
    }
    if (!collision) { player.x = nx; player.y = ny; socket.emit('move', {x: player.x, y: player.y}); }
});

function draw() {
    ctx.fillStyle = "#0d0d0d"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    player.visualX += (player.x - player.visualX) * 0.2;
    player.visualY += (player.y - player.visualY) * 0.2;

    for (let id in mapData) {
        let o = mapData[id]; ctx.save();
        ctx.translate(o.x + o.w/2, o.y + o.h/2); ctx.rotate(o.rot * Math.PI / 180);
        ctx.fillStyle = o.color; ctx.fillRect(-o.w/2, -o.h/2, o.w, o.h); ctx.restore();
    }
    for (let id in otherPlayers) {
        if (id === socket.id) continue;
        ctx.fillStyle = "white"; ctx.beginPath(); ctx.arc(otherPlayers[id].x, otherPlayers[id].y, 10, 0, Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = player.color; ctx.beginPath(); ctx.arc(player.visualX, player.visualY, 10, 0, Math.PI*2); ctx.fill();
    requestAnimationFrame(draw);
}
draw();
