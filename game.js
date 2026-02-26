const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const cellSize = 20; 
const socket = io();

let mapData = {};
let player = { x: 0, y: 0, visualX: 0, visualY: 0, keys: [], color: '#00ffcc', username: '' };
let otherPlayers = {};

// SERVER LIST & CHAT
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

socket.on('chatUpdate', (data) => {
    const chat = document.getElementById('chat-area');
    chat.innerHTML += `<div class="msg"><b>${data.user}:</b> ${data.msg}</div>`;
    chat.scrollTop = chat.scrollHeight;
});

document.getElementById('chatInput').addEventListener('keydown', (e) => {
    if(e.key === 'Enter' && e.target.value.trim() !== "") {
        socket.emit('chat', e.target.value);
        e.target.value = "";
    }
});

function hostMaze() {
    const name = document.getElementById('roomName').value;
    const dataStr = document.getElementById('mazeInput').value;
    if(!name || !dataStr) return alert("Fill in name and maze code!");
    socket.emit('createRoom', { roomName: name, mapData: JSON.parse(dataStr) });
    joinRoom(name);
}

function joinRoom(name) {
    player.username = document.getElementById('username').value || "Guest";
    player.color = document.getElementById('playerColor').value;
    socket.emit('joinRoom', { roomName: name, username: player.username, color: player.color });
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

// RENDERING
function draw() {
    ctx.fillStyle = "#121212";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    player.visualX += (player.x - player.visualX) * 0.3; // Faster slide
    player.visualY += (player.y - player.visualY) * 0.3;

    for (let coord in mapData) {
        let [x, y] = coord.split('_').map(Number);
        let obj = mapData[coord];
        let px = x * cellSize, py = y * cellSize;

        if (obj.type === 'door') {
            // NEW DOOR LOOK: Prison Bars
            ctx.fillStyle = obj.color;
            ctx.fillRect(px, py, cellSize, cellSize);
            ctx.fillStyle = "rgba(0,0,0,0.5)";
            for(let i=0; i<3; i++) ctx.fillRect(px + 4 + (i*5), py, 2, cellSize);
        } else if (obj.type === 'portal') {
            ctx.strokeStyle = obj.color; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(px+10, py+10, 7, 0, Math.PI*2); ctx.stroke();
            ctx.beginPath(); ctx.arc(px+10, py+10, 4, 0, Math.PI*2); ctx.stroke();
        } else if (obj.type === 'key') {
            ctx.strokeStyle = obj.color; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(px+10, py+6, 3, 0, Math.PI*2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(px+10, py+9); ctx.lineTo(px+10, py+16); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(px+10, py+14); ctx.lineTo(px+14, py+14); ctx.stroke();
        } else if (obj.type === 'wall') {
            ctx.fillStyle = obj.color;
            ctx.fillRect(px, py, cellSize, cellSize);
            ctx.strokeStyle = "rgba(0,0,0,0.2)"; ctx.strokeRect(px, py, cellSize, cellSize);
        } else if (obj.type === 'start' || obj.type === 'end') {
            ctx.strokeStyle = "white"; ctx.strokeRect(px+2, py+2, cellSize-4, cellSize-4);
        }
    }

    // DRAW OTHER PLAYERS + USERNAMES
    for (let id in otherPlayers) {
        if (id === socket.id) continue;
        let p = otherPlayers[id];
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x*cellSize+10, p.y*cellSize+10, 6, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "white"; ctx.font = "10px Arial"; ctx.textAlign = "center";
        ctx.fillText(p.username, p.x*cellSize+10, p.y*cellSize - 5);
    }

    // LOCAL PLAYER
    ctx.fillStyle = player.color;
    ctx.beginPath(); ctx.arc(player.visualX*cellSize+10, player.visualY*cellSize+10, 7, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "white"; ctx.fillText(player.username, player.visualX*cellSize+10, player.visualY*cellSize - 5);

    requestAnimationFrame(draw);
}

// MOVEMENT (WASD)
window.addEventListener('keydown', (e) => {
    if(document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
    
    let nx = player.x, ny = player.y;
    const key = e.key.toLowerCase();
    if (key === 'w') ny--; if (key === 's') ny++; if (key === 'a') nx--; if (key === 'd') nx++;

    const cell = mapData[`${nx}_${ny}`];
    if (!cell || (cell.type !== 'wall' && cell.type !== 'door')) {
        player.x = nx; player.y = ny;
        if (cell?.type === 'key') { player.keys.push(cell.id); delete mapData[`${nx}_${ny}`]; }
        if (cell?.type === 'portal') {
            for (let loc in mapData) {
                if (mapData[loc].type === 'portal' && mapData[loc].id === cell.id && loc !== `${nx}_${ny}`) {
                    let [tx, ty] = loc.split('_').map(Number); player.x = tx; player.y = ty; break;
                }
            }
        }
        socket.emit('move', { x: player.x, y: player.y });
    } else if (cell.type === 'door' && player.keys.includes(cell.id)) {
        delete mapData[`${nx}_${ny}`]; player.x = nx; player.y = ny;
        socket.emit('move', { x: player.x, y: player.y });
    }
});

draw();
