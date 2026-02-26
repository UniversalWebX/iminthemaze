const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const cellSize = 20; 
const socket = io();

let mapData = {};
let player = { x: 0, y: 0, visualX: 0, visualY: 0, keys: [], color: '#00ffcc' };
let otherPlayers = {};

// RESIZING & SPAWNING
function autoResizeCanvas(data) {
    let maxX = 0, maxY = 0;
    Object.keys(data).forEach(coord => {
        const [x, y] = coord.split('_').map(Number);
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    });
    canvas.width = (maxX + 1) * cellSize;
    canvas.height = (maxY + 1) * cellSize;
}

// SERVER HANDLERS
socket.on('roomList', (list) => {
    const listDiv = document.getElementById('roomList');
    listDiv.innerHTML = list.length ? "" : "No active mazes...";
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
    const dataStr = document.getElementById('mazeInput').value;
    if(!name || !dataStr) return alert("Missing Room Name or Maze Code!");
    socket.emit('createRoom', { roomName: name, mapData: JSON.parse(dataStr) });
    joinRoom(name);
}

function joinRoom(name) {
    player.color = document.getElementById('playerColor').value;
    socket.emit('joinRoom', name);
    document.getElementById('curRoom').innerText = name;
}

socket.on('mapUpdate', (data) => {
    mapData = data;
    autoResizeCanvas(data);
    for (let key in mapData) {
        if (mapData[key].type === 'start') {
            let [x, y] = key.split('_').map(Number);
            player.x = player.visualX = x;
            player.y = player.visualY = y;
            break;
        }
    }
});

socket.on('state', (players) => { otherPlayers = players; });

// RENDERING
function draw() {
    ctx.fillStyle = "#121212";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    player.visualX += (player.x - player.visualX) * 0.2;
    player.visualY += (player.y - player.visualY) * 0.2;

    for (let coord in mapData) {
        let [x, y] = coord.split('_').map(Number);
        let obj = mapData[coord];
        let px = x * cellSize, py = y * cellSize;
        let midX = px + cellSize/2, midY = py + cellSize/2;

        ctx.fillStyle = obj.color;
        ctx.strokeStyle = obj.color;

        if (obj.type === 'portal') {
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(midX, midY, cellSize/2 - 4, 0, Math.PI*2); ctx.stroke();
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(midX, midY, cellSize/2 - 7, 0, Math.PI*2); ctx.stroke();
        } else if (obj.type === 'key') {
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(midX, py + 6.5, 3.5, 0, Math.PI*2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(midX, py + 10); ctx.lineTo(midX, py + cellSize - 4); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(midX, py + cellSize - 6); ctx.lineTo(midX + 4, py + cellSize - 6); ctx.stroke();
        } else if (obj.type === 'start' || obj.type === 'end') {
            ctx.fillStyle = "#333"; ctx.strokeStyle = "white";
            ctx.fillRect(px, py, cellSize, cellSize); ctx.strokeRect(px, py, cellSize, cellSize);
            ctx.fillStyle = "white"; ctx.font = "bold 12px Arial"; ctx.textAlign = "center";
            ctx.fillText(obj.type[0].toUpperCase(), midX, midY + 4);
        } else {
            ctx.fillRect(px, py, cellSize, cellSize);
            ctx.strokeStyle = "#222"; ctx.strokeRect(px, py, cellSize, cellSize);
        }
    }

    // DRAW PLAYERS
    for (let id in otherPlayers) {
        if (id === socket.id) continue;
        let p = otherPlayers[id];
        ctx.fillStyle = p.color; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.arc(p.x*cellSize+cellSize/2, p.y*cellSize+cellSize/2, cellSize/3, 0, Math.PI*2); ctx.fill();
    }

    ctx.globalAlpha = 1.0;
    ctx.fillStyle = player.color;
    ctx.beginPath(); ctx.arc(player.visualX*cellSize+cellSize/2, player.visualY*cellSize+cellSize/2, cellSize/3, 0, Math.PI*2); ctx.fill();

    requestAnimationFrame(draw);
}

// MOVEMENT (WASD)
window.addEventListener('keydown', (e) => {
    let nx = player.x, ny = player.y;
    const key = e.key.toLowerCase();
    
    if (key === 'w') ny--;
    if (key === 's') ny++;
    if (key === 'a') nx--;
    if (key === 'd') nx++;

    const cell = mapData[`${nx}_${ny}`];
    if (!cell || (cell.type !== 'wall' && cell.type !== 'door')) {
        player.x = nx; player.y = ny;

        if (cell?.type === 'key') {
            player.keys.push(cell.id);
            delete mapData[`${nx}_${ny}`];
            document.getElementById('keys').innerText = player.keys.length;
        }
        
        if (cell?.type === 'portal') {
            for (let loc in mapData) {
                if (mapData[loc].type === 'portal' && mapData[loc].id === cell.id && loc !== `${nx}_${ny}`) {
                    let [tx, ty] = loc.split('_').map(Number);
                    player.x = tx; player.y = ty;
                    break;
                }
            }
        }
        
        if (cell?.type === 'end') alert("Maze Complete!");
        socket.emit('move', { x: player.x, y: player.y, color: player.color });
    } else if (cell.type === 'door' && player.keys.includes(cell.id)) {
        delete mapData[`${nx}_${ny}`];
        player.x = nx; player.y = ny;
        socket.emit('move', { x: player.x, y: player.y, color: player.color });
    }
});

draw();
