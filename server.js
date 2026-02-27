const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let rooms = {};

io.on('connection', (socket) => {
    // Send existing rooms to the user upon connection
    socket.emit('roomList', Object.keys(rooms));

    socket.on('createRoom', (data) => {
        const { roomName, mapData } = data;
        if (!roomName) return;

        rooms[roomName] = {
            mapData: mapData,
            players: {}
        };
        console.log(`Room Created: ${roomName}`);
        // Broadcast updated room list to all connected clients
        io.emit('roomList', Object.keys(rooms));
    });

    socket.on('joinRoom', (data) => {
        const { roomName, username, color } = data;
        if (rooms[roomName]) {
            socket.join(roomName);
            rooms[roomName].players[socket.id] = { 
                x: 0, y: 0, 
                username: username || "Player", 
                color: color || "#00ffcc",
                inventory: []
            };

            socket.emit('mapUpdate', rooms[roomName].mapData);
            io.to(roomName).emit('state', rooms[roomName].players);
        }
    });

    socket.on('move', (pos) => {
        for (let r in rooms) {
            if (rooms[r].players[socket.id]) {
                rooms[r].players[socket.id].x = pos.x;
                rooms[r].players[socket.id].y = pos.y;
                io.to(r).emit('state', rooms[r].players);
                break;
            }
        }
    });

    socket.on('disconnect', () => {
        for (let r in rooms) {
            if (rooms[r].players[socket.id]) {
                delete rooms[r].players[socket.id];
                if (Object.keys(rooms[r].players).length === 0) delete rooms[r];
                io.emit('roomList', Object.keys(rooms));
                break;
            }
        }
    });
});

// Configured to Port 1000 as requested
const PORT = process.env.PORT || 1000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
