const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let rooms = {}; // Structure: { roomName: { mapData: {}, players: {} } }

io.on('connection', (socket) => {
    let currentRoom = null;

    // Send the list of active mazes to a new player
    socket.emit('roomList', Object.keys(rooms));

    socket.on('createRoom', (data) => {
        const { roomName, mapData } = data;
        if (!rooms[roomName]) {
            rooms[roomName] = { mapData: mapData, players: {} };
            io.emit('roomList', Object.keys(rooms)); // Update everyone's list
            console.log(`Room created: ${roomName}`);
        }
    });

    socket.on('joinRoom', (roomName) => {
        if (rooms[roomName]) {
            if (currentRoom) socket.leave(currentRoom);
            socket.join(roomName);
            currentRoom = roomName;
            
            // Add player to room
            rooms[roomName].players[socket.id] = { x: 0, y: 0, color: '#00ffcc' };
            
            // Send the map data only to the player joining
            socket.emit('mapUpdate', rooms[roomName].mapData);
            console.log(`${socket.id} joined ${roomName}`);
        }
    });

    socket.on('move', (data) => {
        if (currentRoom && rooms[currentRoom]) {
            rooms[currentRoom].players[socket.id] = data;
            io.to(currentRoom).emit('state', rooms[currentRoom].players);
        }
    });

    socket.on('disconnect', () => {
        if (currentRoom && rooms[currentRoom]) {
            delete rooms[currentRoom].players[socket.id];
            
            // Check if room is empty
            if (Object.keys(rooms[currentRoom].players).length === 0) {
                delete rooms[currentRoom];
                io.emit('roomList', Object.keys(rooms)); // Update list for everyone
                console.log(`Room closed: ${currentRoom}`);
            } else {
                io.to(currentRoom).emit('state', rooms[currentRoom].players);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
