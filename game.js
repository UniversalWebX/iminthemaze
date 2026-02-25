// Example data structure exported from Python
const rawMapData = '{"5_5": {"type": "key", "color": "#ff0000", "id": 1}, "8_5": {"type": "door", "color": "#ff0000", "id": 1}}';
let mapData = JSON.parse(rawMapData);

let player = { 
    x: 1, 
    y: 1, 
    keychain: [] // This stores the IDs of keys we picked up
};

function handleMovement(nx, ny) {
    const cell = mapData[`${nx}_${ny}`];

    if (!cell || cell.type !== 'wall') {
        
        // KEY LOGIC
        if (cell && cell.type === 'key') {
            player.keychain.push(cell.id); // Add this specific ID to our keychain
            delete mapData[`${nx}_${ny}`];
            console.log("Picked up key ID:", cell.id);
        }

        // DOOR LOGIC
        if (cell && cell.type === 'door') {
            if (player.keychain.includes(cell.id)) {
                delete mapData[`${nx}_${ny}`]; // Unlock!
                console.log("Unlocked door ID:", cell.id);
            } else {
                console.log("You need key ID:", cell.id);
                return; // Block movement
            }
        }

        player.x = nx;
        player.y = ny;
    }
    draw();
}
