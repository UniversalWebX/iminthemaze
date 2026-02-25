const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gridSize = 25;
const cellSize = 20;
canvas.width = canvas.height = gridSize * cellSize;

// --- PASTE YOUR EXPORTED CODE INSIDE THE QUOTES BELOW ---
const rawMapData = '{}'; 
// -------------------------------------------------------

let mapData = JSON.parse(rawMapData);
let player = { x: 0, y: 0, keychain: [], color: '#3498db' };

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render Map Objects
    for (let coord in mapData) {
        let [x, y] = coord.split('_').map(Number);
        let obj = mapData[coord];
        
        ctx.fillStyle = obj.color;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        
        // Visual indicator for IDs
        if (obj.id > 0) {
            ctx.fillStyle = "white";
            ctx.font = "10px Arial";
            ctx.fillText(obj.id, x * cellSize + 5, y * cellSize + 15);
        }
    }

    // Render Player
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(player.x * cellSize + cellSize/2, player.y * cellSize + cellSize/2, cellSize/3, 0, Math.PI*2);
    ctx.fill();
}

window.addEventListener('keydown', (e) => {
    let nx = player.x;
    let ny = player.y;

    if (e.key === 'ArrowUp') ny--;
    if (e.key === 'ArrowDown') ny++;
    if (e.key === 'ArrowLeft') nx--;
    if (e.key === 'ArrowRight') nx++;

    const targetKey = `${nx}_${ny}`;
    const cell = mapData[targetKey];

    // Collision & Logic
    if (!cell || cell.type !== 'wall') {
        
        if (cell) {
            if (cell.type === 'key') {
                player.keychain.push(cell.id);
                delete mapData[targetKey];
                document.getElementById('keys').innerText = player.keychain.join(', ');
            } 
            
            else if (cell.type === 'door') {
                if (player.keychain.includes(cell.id)) {
                    delete mapData[targetKey]; // Unlock door
                } else {
                    return; // Blocked: Don't have the right ID
                }
            } 
            
            else if (cell.type === 'portal') {
                // Find matching portal ID
                for (let loc in mapData) {
                    if (mapData[loc].type === 'portal' && mapData[loc].id === cell.id && loc !== targetKey) {
                        let [tx, ty] = loc.split('_').map(Number);
                        player.x = tx; player.y = ty;
                        draw();
                        return;
                    }
                }
            }
        }

        // Standard movement if not a wall or blocked door
        if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
            player.x = nx;
            player.y = ny;
        }
    }
    draw();
});

draw();
