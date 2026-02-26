const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const cellSize = 22;
const socket = io();

let mapData = {};
let player = { x: 0, y: 0, visualX: 0, visualY: 0, keys: [], color: '#00ffcc' };
let otherPlayers = {};

socket.on('roomList', (list) => {
    const listDiv = document.getElementById('roomList');
    listDiv.innerHTML = list.length ? "" : "No active mazes...";
    list.forEach(name => {
        let div = document.createElement('div');
        div.className = 'room-item';
        div.innerText = name;
        div.onclick = () => joinRoom(name);
        listDiv.appendChild(div);
    });
});

function hostMaze() {
    const name = document.getElementById('roomName').value;
    const dataStr = document.getElementById('mazeInput').value;
    if(!name || !dataStr) return alert("Enter name and code!");
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
    let maxX = 0, maxY = 0;
    Object.keys(data).forEach(c => {
        const [x, y] = c.split('_').map(Number);
        if(x > maxX) maxX = x; if(y > maxY) maxY = y;
    });
    canvas.width = (maxX + 1) * cellSize;
    canvas.height = (maxY + 1) * cellSize;

    for (let key in mapData) {
        if (mapData[key].type === 'start') {
            let [x, y] = key.split('_').map(Number);
            player.x = player.visualX = x; player.y = player.visualY = y;
            break;
        }
    }
});

socket.on('state', (players) => { otherPlayers = players; });

function draw() {
    ctx.fillStyle = "#121212";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    player.visualX += (player.x - player.visualX) * 0.2;
    player.visualY += (player.y - player.visualY) * 0.2;

    for (let coord in mapData) {
        let [x, y] = coord.split('_').map(Number);
        let obj = mapData[coord];
        ctx.fillStyle = obj.color;
        if(obj.type === 'portal') {
            ctx.strokeStyle = obj.color; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(x*cellSize+11, y*cellSize+11, 7, 0, Math.PI*2); ctx.stroke();
        } else if(obj.type === 'key') {
            ctx.fillRect(x*cellSize+8, y*cellSize+4, 6, 6);
            ctx.fillRect(x*cellSize+10, y*cellSize+10, 2, 8);
        } else if(obj.type === 'start' || obj.type === 'end') {
            ctx.globalAlpha = 0.2; ctx.fillRect(x*cellSize, y*cellSize, cellSize, cellSize);
            ctx.globalAlpha = 1.0; ctx.strokeStyle = "white"; ctx.strokeRect(x*cellSize+4, y*cellSize+4, cellSize-8, cellSize-8);
        } else {
            ctx.fillRect(x*cellSize, y*cellSize, cellSize, cellSize);
        }
    }

    for (let id in otherPlayers) {
        if (id === socket.id) continue;
        let p = otherPlayers[id];
        ctx.fillStyle = p.color; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.arc(p.x*cellSize+11, p.y*cellSize+11, 6, 0, Math.PI*2); ctx.fill();
    }

    ctx.globalAlpha = 1.0; ctx.fillStyle = player.color;
    ctx.beginPath(); ctx.arc(player.visualX*cellSize+11, player.visualY*cellSize+11, 7, 0, Math.PI*2); ctx.fill();
    requestAnimationFrame(draw);
}

window.addEventListener('keydown', (e) => {
    let nx = player.x, ny = player.y;
    if (e.key === 'ArrowUp') ny--;
    if (e.key === 'ArrowDown') ny++;
    if (e.key === 'ArrowLeft') nx--;
    if (e.key === 'ArrowRight') nx++;

    const cell = mapData[`${nx}_${ny}`];
    if (!cell || (cell.type !== 'wall' && cell.type !== 'door')) {
        player.x = nx; player.y = ny;
        if (cell?.type === 'key') { player.keys.push(cell.id); delete mapData[`${nx}_${ny}`]; document.getElementById('keys').innerText = player.keys.length; }
        if (cell?.type === 'portal') {
            for (let loc in mapData) {
                if (mapData[loc].type === 'portal' && mapData[loc].id === cell.id && loc !== `${nx}_${ny}`) {
                    let [tx, ty] = loc.split('_').map(Number); player.x = tx; player.y = ty; break;
                }
            }
        }
        if(cell?.type === 'end') alert("Maze Complete!");
        socket.emit('move', { x: player.x, y: player.y, color: player.color });
    } else if (cell.type === 'door' && player.keys.includes(cell.id)) {
        delete mapData[`${nx}_${ny}`]; player.x = nx; player.y = ny;
        socket.emit('move', { x: player.x, y: player.y, color: player.color });
    }
});
draw();
