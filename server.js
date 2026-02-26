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
            rooms[roomName] = { mapData: mapData, players: {} };
            io.emit('roomList', Object.keys(rooms));
        }
    });

    socket.on('joinRoom', (roomName) => {
        if (rooms[roomName]) {
            if (currentRoom) socket.leave(currentRoom);
            socket.join(roomName);
            currentRoom = roomName;
            rooms[roomName].players[socket.id] = { x: 0, y: 0, color: '#00ffcc' };
            socket.emit('mapUpdate', rooms[roomName].mapData);
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
