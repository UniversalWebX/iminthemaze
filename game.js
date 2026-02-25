const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const cellSize = 22;
const socket = io();

let mapData = {};
let player = { x: 0, y: 0, visualX: 0, visualY: 0, keys: [], color: '#00ffcc' };
let otherPlayers = {};

// --- SERVER LIST LOGIC ---
socket.on('roomList', (list) => {
    const listDiv = document.getElementById('roomList');
    listDiv.innerHTML = "";
    list.forEach(name => {
        let div = document.createElement('div');
        div.className = 'room-item';
        div.innerText = "Join: " + name;
        div.onclick = () => joinRoom(name);
        listDiv.appendChild(div);
    });
});

function hostMaze() {
    const name = document.getElementById('roomName').value;
    const data = document.getElementById('mazeInput').value;
    if(!name || !data) return alert("Enter name and code!");
    
    socket.emit('createRoom', { roomName: name, mapData: JSON.parse(data) });
    joinRoom(name);
}

function joinRoom(name) {
    socket.emit('joinRoom', name);
    document.getElementById('curRoom').innerText = name;
}

socket.on('mapUpdate', (data) => {
    mapData = data;
    // Find spawn point
    for (let key in mapData) {
        if (mapData[key].type === 'start') {
            let [x, y] = key.split('_').map(Number);
            player.x = player.visualX = x;
            player.y = player.visualY = y;
            break;
        }
    }
});

socket.on('state', (players) => {
    otherPlayers = players;
});

// --- RENDER & MOVEMENT (Same as before but inside draw loop) ---
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    player.visualX += (player.x - player.visualX) * 0.2;
    player.visualY += (player.y - player.visualY) * 0.2;

    for (let coord in mapData) {
        let [x, y] = coord.split('_').map(Number);
        let obj = mapData[coord];
        ctx.fillStyle = obj.color;
        if(obj.type === 'portal') {
            ctx.beginPath(); ctx.arc(x*cellSize+11, y*cellSize+11, 7, 0, Math.PI*2); ctx.stroke();
        } else {
            ctx.fillRect(x*cellSize, y*cellSize, cellSize, cellSize);
        }
    }

    for (let id in otherPlayers) {
        if (id === socket.id) continue;
        ctx.fillStyle = otherPlayers[id].color;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(otherPlayers[id].x*cellSize, otherPlayers[id].y*cellSize, cellSize, cellSize);
    }

    ctx.globalAlpha = 1.0;
    ctx.fillStyle = player.color;
    ctx.fillRect(player.visualX*cellSize, player.visualY*cellSize, cellSize, cellSize);
    
    requestAnimationFrame(draw);
}

window.addEventListener('keydown', (e) => {
    // ... (Use the same movement/collision logic from previous response)
    // Add this at the end of a successful move:
    socket.emit('move', { x: player.x, y: player.y, color: player.color });
});

draw();
