const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const cellSize = 30;

// PASTE JSON HERE
const rawData = '{}'; 
let mapData = JSON.parse(rawData);

// Animation State
let player = { x: 0, y: 0, visualX: 0, visualY: 0, keys: [], color: '#00ffcc' };
let targetX = 0, targetY = 0;

// Initialize Start Position
for (let key in mapData) {
    if (mapData[key].type === 'start') {
        let [x, y] = key.split('_').map(Number);
        player.x = player.visualX = x;
        player.y = player.visualY = y;
    }
}

function draw() {
    ctx.fillStyle = "#121212";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Smooth Interpolation
    player.visualX += (player.x - player.visualX) * 0.2;
    player.visualY += (player.y - player.visualY) * 0.2;

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
            ctx.fillRect(px + 10, py + 10, 10, 10); // Simple Key Icon
        } else if (obj.type === 'end') {
            ctx.fillStyle = "rgba(231, 76, 60, 0.3)";
            ctx.fillRect(px, py, cellSize, cellSize);
            ctx.strokeStyle = "#e74c3c";
            ctx.strokeRect(px+2, py+2, cellSize-4, cellSize-4);
        } else {
            ctx.fillStyle = obj.color;
            ctx.fillRect(px, py, cellSize, cellSize);
        }
    }

    // Draw Player
    ctx.fillStyle = player.color;
    ctx.shadowBlur = 15;
    ctx.shadowColor = player.color;
    ctx.beginPath();
    ctx.arc(player.visualX * cellSize + cellSize/2, player.visualY * cellSize + cellSize/2, cellSize/4, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;

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
        
        if (cell?.type === 'end') alert("MAZE COMPLETE!");
        if (cell?.type === 'portal') {
            // Portal logic remains same, finding matching ID...
        }
    } else if (cell.type === 'door' && player.keys.includes(cell.id)) {
        delete mapData[`${nx}_${ny}`];
        player.x = nx; player.y = ny;
    }
});

draw();
