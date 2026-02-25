const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Serve static files (HTML/JS)
app.use(express.static(__dirname));

let players = {};

io.on('connection', (socket) => {
    players[socket.id] = { x: 0, y: 0, color: '#3498db' };
    
    socket.on('move', (data) => {
        players[socket.id] = data;
        io.emit('state', players); // Send positions to everyone
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('state', players);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server on port ${PORT}`));
