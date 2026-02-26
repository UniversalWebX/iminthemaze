const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let rooms = {}; 

io.on('connection', (socket) => {
    let currentRoom = null;

    socket.emit('roomList', Object.keys(rooms));

    socket.on('createRoom', (data) => {
        const { roomName, mapData } = data;
        if (!rooms[roomName]) {
            rooms[roomName] = { mapData: mapData, players: {}, messages: [] };
            io.emit('roomList', Object.keys(rooms));
        }
    });

    socket.on('joinRoom', (data) => {
        const { roomName, username, color } = data;
        if (rooms[roomName]) {
            if (currentRoom) socket.leave(currentRoom);
            socket.join(roomName);
            currentRoom = roomName;
            rooms[roomName].players[socket.id] = { x: 0, y: 0, color: color, username: username };
            socket.emit('mapUpdate', rooms[roomName].mapData);
        }
    });

    socket.on('move', (data) => {
        if (currentRoom && rooms[currentRoom]) {
            rooms[currentRoom].players[socket.id] = { ...rooms[currentRoom].players[socket.id], ...data };
            // High-frequency broadcast to the room only
            io.to(currentRoom).emit('state', rooms[currentRoom].players);
        }
    });

    socket.on('chat', (msg) => {
        if (currentRoom && rooms[currentRoom]) {
            const user = rooms[currentRoom].players[socket.id]?.username || "Anon";
            io.to(currentRoom).emit('chatUpdate', { user, msg });
        }
    });

    socket.on('disconnect', () => {
        if (currentRoom && rooms[currentRoom]) {
            delete rooms[currentRoom].players[socket.id];
            if (Object.keys(rooms[currentRoom].players).length === 0) {
                delete rooms[currentRoom];
                io.emit('roomList', Object.keys(rooms));
            } else {
                io.to(currentRoom).emit('state', rooms[currentRoom].players);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
