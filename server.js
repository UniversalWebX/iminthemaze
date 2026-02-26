const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(__dirname));

let rooms = {};

// API for Python Editor
app.post('/api/create-room', (req, res) => {
    const { roomName, mapData } = req.body;
    rooms[roomName] = {
        mapData,
        players: { "dummy_bot": { x: 0, y: 0, username: "DUMMY_BOT", color: "#555", isBot: true } },
    };
    io.emit('roomList', Object.keys(rooms));
    res.sendStatus(200);
});

io.on('connection', (socket) => {
    socket.emit('roomList', Object.keys(rooms));

    socket.on('joinRoom', (data) => {
        const { roomName, username, color } = data;
        if (rooms[roomName]) {
            socket.join(roomName);
            // Destroy dummy if real player joins
            if (rooms[roomName].players["dummy_bot"]) {
                delete rooms[roomName].players["dummy_bot"];
            }
            rooms[roomName].players[socket.id] = { x: 0, y: 0, username, color };
            socket.emit('mapUpdate', rooms[roomName].mapData);
            io.to(roomName).emit('state', rooms[roomName].players);
        }
    });

    socket.on('move', (pos) => {
        // ... update logic
    });
});

server.listen(process.env.PORT || 3000);
