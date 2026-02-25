const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let players = {};

io.on('connection', (socket) => {
    console.log('Player joined:', socket.id);

    socket.on('move', (data) => {
        players[socket.id] = data;
        // Send all player positions to everyone
        io.emit('state', players);
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('state', players);
        console.log('Player left:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
