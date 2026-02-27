const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let rooms = {};

io.on('connection', (socket) => {
    socket.emit('roomList', Object.keys(rooms));

    socket.on('createRoom', (data) => {
        const { roomName, mapData } = data;
        rooms[roomName] = {
            mapData: mapData,
            players: { "dummy": { x: 0, y: 0, username: "SERVER", color: "#333" } }
        };
        io.emit('roomList', Object.keys(rooms));
    });

    socket.on('joinRoom', (data) => {
        const { roomName, username, color } = data;
        if (rooms[roomName]) {
            socket.join(roomName);
            if (rooms[roomName].players["dummy"]) delete rooms[roomName].players["dummy"];
            rooms[roomName].players[socket.id] = { x: 100, y: 100, username, color };
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

server.listen(process.env.PORT || 3000);
