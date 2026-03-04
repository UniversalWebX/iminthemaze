const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, { cors: { origin: "*" } });
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI("YOUR_GEMINI_API_KEY"); // ← replace with real key
app.use(express.static(__dirname));

let rooms = {};

io.on('connection', (socket) => {
    socket.emit('roomList', Object.keys(rooms));

    socket.on('askAI', async (prompt) => {
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const aiPrompt = `Generate a JSON maze for a 1200x800 grid. Snap: 20px. 
            Format: {"id": {"type": "wall|door|key|portal|start|end", "x":0, "y":0, "w":20, "h":20, "color":"hex", "rot":0, "linkId":""}}.
            User Request: "${prompt}". Return raw JSON only.`;
            const result = await model.generateContent(aiPrompt);
            const text = (await result.response).text().replace(/```json|```/g, "").trim();
            socket.emit('aiResponse', JSON.parse(text));
        } catch (e) {
            console.error(e);
            socket.emit('aiError', "AI Error");
        }
    });

    socket.on('createRoom', (data) => {
        if (!data.roomName || rooms[data.roomName]) return;
        rooms[data.roomName] = { mapData: data.mapData || {}, players: {} };
        io.emit('roomList', Object.keys(rooms));
    });

    socket.on('joinRoom', (data) => {
        if (!rooms[data.roomName]) return;

        socket.join(data.roomName);

        const s = Object.values(rooms[data.roomName].mapData).find(o => o.type === 'start');
        const sx = s ? s.x + 10 : 10;
        const sy = s ? s.y + 10 : 10;

        rooms[data.roomName].players[socket.id] = { 
            x: sx, 
            y: sy, 
            username: data.username || "Player", 
            color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6,'0')
        };

        socket.emit('mapUpdate', rooms[data.roomName].mapData);
        io.to(data.roomName).emit('state', rooms[data.roomName].players);
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
                io.to(r).emit('state', rooms[r].players);
                break;
            }
        }
    });
});

server.listen(1000, '0.0.0.0', () => {
    console.log("Server listening on port 1000");
});
