// Inside the draw() function loop
for (let id in mapData) {
    let obj = mapData[id];
    ctx.save();
    
    // Move to object center for rotation
    ctx.translate(obj.x + obj.w/2, obj.y + obj.h/2);
    ctx.rotate((obj.rot * Math.PI) / 180);
    
    ctx.fillStyle = obj.color;
    
    if (obj.type === 'wall') {
        // Draw using width (w) and height (h) instead of fixed cellSize
        ctx.fillRect(-obj.w/2, -obj.h/2, obj.w, obj.h);
    } else if (obj.type === 'door') {
        ctx.fillRect(-obj.w/2, -obj.h/2, obj.w, obj.h);
        ctx.fillStyle = "black";
        ctx.fillRect(-obj.w/2 + 2, -obj.h/2, 2, obj.h); // Bars
    }
    
    ctx.restore();
}

// WASD Movement remains the same, but collision now uses Box Bounding
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    let nx = player.x, ny = player.y;
    if (key === 'w') ny -= 5; // Pixel-based movement for box systems
    if (key === 's') ny += 5;
    if (key === 'a') nx -= 5;
    if (key === 'd') nx += 5;

    // AABB Collision Detection
    let collision = false;
    for(let id in mapData) {
        let o = mapData[id];
        if(o.type === 'wall' && nx < o.x + o.w && nx + 15 > o.x && ny < o.y + o.h && ny + 15 > o.y) {
            collision = true;
        }
    }
    if(!collision) { player.x = nx; player.y = ny; }
    socket.emit('move', {x: player.x, y: player.y});
});
