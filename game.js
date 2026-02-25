const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const cellSize = 22; // Matches Python Pro v3
const gridSize = 30;
canvas.width = canvas.height = gridSize * cellSize;

let mapData = {}; 
let player = { x: 0, y: 0, visualX: 0, visualY: 0, keys: [], color: '#00ffcc' };
let otherPlayers = {};

// 1. SOCKET CONNECTION
const socket = io(); // Connects to your Render URL automatically

socket.on('connect', () => {
    document.getElementById('status').innerText = "Connected";
    document.getElementById('status').style.color = "#27ae60";
});

socket.on('state', (serverPlayers) => {
    otherPlayers = serverPlayers;
});

// 2. MAZE LOADER FUNCTION
function loadNewMaze() {
    const input = document.getElementById('mazeInput').value;
    try {
        mapData = JSON.parse(input);
        
        // Find Start Position
        let foundStart = false;
        for (let key in mapData) {
            if (mapData[key].type === 'start') {
                let [x, y] = key.split('_').map(Number);
                player.x = player.visualX = x;
                player.y = player.visualY = y;
                foundStart = true;
                break;
            }
        }
        if(!foundStart) alert("Warning: No Start Point found in this maze!");
        
        console.log("Maze Loaded Successfully");
    } catch (e) {
        alert("Invalid Code! Make sure you copied everything from Python.");
    }
}

// 3. CORE DRAW LOOP
function draw() {
    ctx.fillStyle = "#121212";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Smooth Slide
    player.visualX += (player.x - player.visualX) * 0.2;
    player.visualY += (player.y - player.visualY) * 0.2;

    // Draw Map Objects
    for (let coord in mapData) {
        let [x, y] = coord.split('_').map(Number);
        let obj = mapData[coord];
        let px = x * cellSize, py = y * cellSize;

        ctx.fillStyle = obj.color;
        if (obj.type === 'portal') {
            ctx.strokeStyle = obj.color; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(px + cellSize/2, py + cellSize/2, cellSize/3, 0, Math.PI*2);
            ctx.stroke();
        } else if (obj.type === 'key') {
            ctx.fillRect(px+8, py+4, 6, 6); // Simple Head
            ctx.fillRect(px+10, py+10, 2, 8); // Shaft
        } else if (obj.type === 'start' || obj.type === 'end') {
            ctx.globalAlpha = 0.3; ctx.fillRect(px, py, cellSize, cellSize);
            ctx.globalAlpha = 1.0; ctx.strokeStyle = "white"; ctx.strokeRect(px+4, py+4, cellSize-8, cellSize-8);
        } else {
            ctx.fillRect(px, py, cellSize, cellSize);
        }
    }

    // Draw Other Players
    for (let id in otherPlayers) {
        if (id === socket.id) continue;
        let p = otherPlayers[id];
        ctx.fillStyle = p.color; ctx.globalAlpha = 0.4;
        ctx.beginPath(); ctx.arc(p.x * cellSize + cellSize/2, p.y * cellSize + cellSize/2, cellSize/4, 0, Math.PI*2); ctx.fill();
    }

    // Draw Local Player
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(player.visualX * cellSize + cellSize/2, player.visualY * cellSize + cellSize/2, cellSize/4, 0, Math.PI*2);
    ctx.fill();

    requestAnimationFrame(draw);
}

// 4. MOVEMENT & COLLISION
window.addEventListener('keydown', (e) => {
    let nx = player.x, ny = player.y;
    if (e.key === 'ArrowUp') ny--;
    if (e.key === 'ArrowDown') ny++;
    if (e.key === 'ArrowLeft') nx--;
    if (e.key === 'ArrowRight') nx++;

    const cell = mapData[`${nx}_${ny}`];
    
    // Check if walkable
    if (!cell || (cell.type !== 'wall' && cell.type !== 'door')) {
        player.x = nx; player.y = ny;

        if (cell?.type === 'key') {
            player.keys.push(cell.id);
            delete mapData[`${nx}_${ny}`];
            document.getElementById('keys').innerText = player.keys.join(', ');
        }
        
        if (cell?.type === 'portal') {
            for (let loc in mapData) {
                if (mapData[loc].type === 'portal' && mapData[loc].id === cell.id && loc !== `${nx}_${ny}`) {
                    let [tx, ty] = loc.split('_').map(Number);
                    player.x = tx; player.y = ty; break;
                }
            }
        }
        
        if (cell?.type === 'end') alert("Victory!");

        // Update Server
        socket.emit('move', { x: player.x, y: player.y, color: player.color });
    } else if (cell.type === 'door' && player.keys.includes(cell.id)) {
        delete mapData[`${nx}_${ny}`]; // Unlock door
        player.x = nx; player.y = ny;
        socket.emit('move', { x: player.x, y: player.y, color: player.color });
    }
});

draw();
