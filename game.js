const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const cellSize = 30;

// PASTE YOUR JSON CODE FROM PYTHON HERE
const rawData = '{"4_3": {"type": "wall", "color": "#5dade2", "id": 0}, "23_21": {"type": "wall", "color": "#5dade2", "id": 0}, "2_3": {"type": "wall", "color": "#5dade2", "id": 0}, "2_4": {"type": "wall", "color": "#5dade2", "id": 0}, "2_5": {"type": "wall", "color": "#5dade2", "id": 0}, "2_6": {"type": "wall", "color": "#5dade2", "id": 0}, "2_7": {"type": "wall", "color": "#5dade2", "id": 0}, "2_8": {"type": "wall", "color": "#5dade2", "id": 0}, "2_9": {"type": "wall", "color": "#5dade2", "id": 0}, "2_10": {"type": "wall", "color": "#5dade2", "id": 0}, "2_11": {"type": "wall", "color": "#5dade2", "id": 0}, "2_12": {"type": "wall", "color": "#5dade2", "id": 0}, "2_13": {"type": "wall", "color": "#5dade2", "id": 0}, "2_14": {"type": "wall", "color": "#5dade2", "id": 0}, "2_15": {"type": "wall", "color": "#5dade2", "id": 0}, "2_16": {"type": "wall", "color": "#5dade2", "id": 0}, "2_17": {"type": "wall", "color": "#5dade2", "id": 0}, "2_18": {"type": "wall", "color": "#5dade2", "id": 0}, "2_19": {"type": "wall", "color": "#5dade2", "id": 0}, "2_20": {"type": "wall", "color": "#5dade2", "id": 0}, "2_21": {"type": "wall", "color": "#5dade2", "id": 0}, "2_22": {"type": "wall", "color": "#5dade2", "id": 0}, "2_23": {"type": "wall", "color": "#5dade2", "id": 0}, "3_23": {"type": "wall", "color": "#5dade2", "id": 0}, "4_23": {"type": "wall", "color": "#5dade2", "id": 0}, "5_23": {"type": "wall", "color": "#5dade2", "id": 0}, "6_23": {"type": "wall", "color": "#5dade2", "id": 0}, "7_23": {"type": "wall", "color": "#5dade2", "id": 0}, "8_23": {"type": "wall", "color": "#5dade2", "id": 0}, "8_22": {"type": "wall", "color": "#5dade2", "id": 0}, "8_21": {"type": "wall", "color": "#5dade2", "id": 0}, "8_20": {"type": "wall", "color": "#5dade2", "id": 0}, "8_19": {"type": "wall", "color": "#5dade2", "id": 0}, "8_18": {"type": "wall", "color": "#5dade2", "id": 0}, "8_17": {"type": "wall", "color": "#5dade2", "id": 0}, "7_17": {"type": "wall", "color": "#5dade2", "id": 0}, "7_16": {"type": "wall", "color": "#5dade2", "id": 0}, "7_15": {"type": "wall", "color": "#5dade2", "id": 0}, "7_14": {"type": "wall", "color": "#5dade2", "id": 0}, "7_13": {"type": "wall", "color": "#5dade2", "id": 0}, "7_12": {"type": "wall", "color": "#5dade2", "id": 0}, "7_11": {"type": "wall", "color": "#5dade2", "id": 0}, "7_10": {"type": "wall", "color": "#5dade2", "id": 0}, "7_9": {"type": "wall", "color": "#5dade2", "id": 0}, "7_8": {"type": "wall", "color": "#5dade2", "id": 0}, "7_7": {"type": "wall", "color": "#5dade2", "id": 0}, "6_7": {"type": "wall", "color": "#5dade2", "id": 0}, "6_6": {"type": "wall", "color": "#5dade2", "id": 0}, "6_5": {"type": "wall", "color": "#5dade2", "id": 0}, "6_4": {"type": "wall", "color": "#5dade2", "id": 0}, "6_3": {"type": "wall", "color": "#5dade2", "id": 0}, "6_2": {"type": "wall", "color": "#5dade2", "id": 0}, "6_1": {"type": "wall", "color": "#5dade2", "id": 0}, "5_1": {"type": "wall", "color": "#5dade2", "id": 0}, "4_1": {"type": "wall", "color": "#5dade2", "id": 0}, "3_1": {"type": "wall", "color": "#5dade2", "id": 0}, "2_1": {"type": "wall", "color": "#5dade2", "id": 0}, "2_2": {"type": "wall", "color": "#5dade2", "id": 0}, "5_21": {"type": "portal", "color": "#5dade2", "id": 33}, "22_18": {"type": "portal", "color": "#5dade2", "id": 33}}
'; 
let mapData = JSON.parse(rawData);

// MULTIPLAYER CONNECTION
// Replace with your Render URL (e.g., https://my-maze.onrender.com)
const socket = io(); 

let player = { x: 0, y: 0, visualX: 0, visualY: 0, keys: [], color: '#00ffcc' };
let otherPlayers = {};

// Find Start Point
for (let key in mapData) {
    if (mapData[key].type === 'start') {
        let [x, y] = key.split('_').map(Number);
        player.x = player.visualX = x;
        player.y = player.visualY = y;
    }
}

socket.on('state', (serverPlayers) => {
    otherPlayers = serverPlayers;
});

function draw() {
    ctx.fillStyle = "#121212";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Smooth Slide Animation
    player.visualX += (player.x - player.visualX) * 0.2;
    player.visualY += (player.y - player.visualY) * 0.2;

    // Draw Map
    for (let coord in mapData) {
        let [x, y] = coord.split('_').map(Number);
        let obj = mapData[coord];
        let px = x * cellSize, py = y * cellSize;

        if (obj.type === 'portal') {
            ctx.strokeStyle = obj.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(px + cellSize/2, py + cellSize/2, cellSize/3, 0, Math.PI*2);
            ctx.stroke();
        } else if (obj.type === 'key') {
            ctx.fillStyle = obj.color;
            ctx.fillRect(px+10, py+10, 10, 10);
        } else {
            ctx.fillStyle = obj.color;
            ctx.fillRect(px, py, cellSize, cellSize);
        }
    }

    // Draw Others
    for (let id in otherPlayers) {
        if (id === socket.id) continue;
        let p = otherPlayers[id];
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(p.x * cellSize + cellSize/2, p.y * cellSize + cellSize/2, cellSize/4, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    // Draw Local Player
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(player.visualX * cellSize + cellSize/2, player.visualY * cellSize + cellSize/2, cellSize/4, 0, Math.PI*2);
    ctx.fill();

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
        
        if (cell?.type === 'portal') {
            for (let loc in mapData) {
                if (mapData[loc].type === 'portal' && mapData[loc].id === cell.id && loc !== `${nx}_${ny}`) {
                    let [tx, ty] = loc.split('_').map(Number);
                    player.x = tx; player.y = ty;
                    break;
                }
            }
        }
        // Tell server we moved
        socket.emit('move', { x: player.x, y: player.y, color: player.color });
    }
});

draw();
