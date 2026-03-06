const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {}; // Store mazes and players per room

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('createRoom', (mazeData) => {
    const roomId = Math.random().toString(36).substring(7);
    rooms[roomId] = {
      maze: mazeData,
      players: {},
      objects: mazeData.objects // Sync objects
    };
    socket.join(roomId);
    socket.emit('roomCreated', roomId);
  });

  socket.on('joinRoom', (roomId) => {
    if (rooms[roomId]) {
      socket.join(roomId);
      socket.emit('mazeData', rooms[roomId].maze);
      io.to(roomId).emit('playersUpdate', rooms[roomId].players);
      socket.emit('objectsUpdate', rooms[roomId].maze.objects);
    } else {
      socket.emit('error', 'Room not found');
    }
  });

  socket.on('playerUpdate', (data) => {
    const roomId = data.roomId;
    if (rooms[roomId]) {
      rooms[roomId].players[socket.id] = data.player;
      io.to(roomId).emit('playersUpdate', rooms[roomId].players);
    }
  });

  socket.on('objectUpdate', (data) => {
    const roomId = data.roomId;
    if (rooms[roomId]) {
      rooms[roomId].maze.objects = data.objects;
      io.to(roomId).emit('objectsUpdate', rooms[roomId].maze.objects);
    }
  });

  socket.on('disconnect', () => {
    for (let roomId in rooms) {
      if (rooms[roomId].players[socket.id]) {
        delete rooms[roomId].players[socket.id];
        io.to(roomId).emit('playersUpdate', rooms[roomId].players);
      }
    }
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
