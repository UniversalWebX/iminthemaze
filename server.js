// ========================
// SERVER.JS - Backend / Socket.IO Server
// Multiplayer Arcade Maze Engine
// ========================

const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: "*",                    // ← In production change to your actual domain(s)
        methods: ["GET", "POST"]
    }
});

const { GoogleGenerativeAI } = require("@google/generative-ai");

// Use environment variable for API key (set this in Render dashboard)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "AIzaSyBnfIO9jE0ZN-q2qnX1x6cN2zz7rIDRetE");

// Use the port Render provides, fallback to 1000 for local dev
const PORT = process.env.PORT || 1000;

// Serve static files (index.html, game.js, etc.)
app.use(express.static(__dirname));

// Optional: Simple health check endpoint (Render & monitoring like it)
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// In-memory storage for rooms (in production consider Redis if scaling)
let rooms = {};

io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);

    // Send current list of rooms to new client
    socket.emit('roomList', Object.keys(rooms));

    // AI maze generation request
    socket.on('askAI', async (prompt) => {
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const aiPrompt = `Generate a JSON maze for a 1200x800 grid. Snap: 20px. 
            Format: {"id": {"type": "wall|door|key|portal|start|end", "x":0, "y":0, "w":20, "h":20, "color":"hex", "rot":0, "linkId":""}}.
            User Request: "${prompt}". Return raw JSON only. No explanations, no markdown.`;

            const result = await model.generateContent(aiPrompt);
            const text = (await result.response).text()
                .replace(/```json|```/g, "")
                .trim();

            let parsed;
            try {
                parsed = JSON.parse(text);
            } catch (parseErr) {
                console.error("AI JSON parse failed:", parseErr);
                socket.emit('aiError', "Invalid JSON from AI");
                return;
            }

            socket.emit('aiResponse', parsed);
        } catch (e) {
            console.error("AI generation error:", e);
            socket.emit('aiError', "AI Error - try again later");
        }
    });

    // Create a new room
    socket.on('createRoom', (data) => {
        if (!data || !data.roomName) return;
        if (rooms[data.roomName]) {
            socket.emit('error', 'Room already exists');
            return;
        }

        rooms[data.roomName] = {
            mapData: data.mapData || {},
            players: {}
        };

        io.emit('roomList', Object.keys(rooms));
        console.log(`Room created: ${data.roomName}`);
    });

    // Join an existing room
    socket.on('joinRoom', (data) => {
        if (!data || !data.roomName || !rooms[data.roomName]) {
            socket.emit('error', 'Room not found');
            return;
        }

        socket.join(data.roomName);

        const room = rooms[data.roomName];
        const startObj = Object.values(room.mapData).find(o => o.type === 'start');
        const startX = startObj ? startObj.x + 10 : 10;
        const startY = startObj ? startObj.y + 10 : 10;

        room.players[socket.id] = {
            x: startX,
            y: startY,
            username: data.username || "Player",
            color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
        };

        // Send map to the joining player
        socket.emit('mapUpdate', room.mapData);

        // Broadcast updated player list to everyone in the room
        io.to(data.roomName).emit('state', room.players);

        console.log(`${data.username || socket.id} joined room: ${data.roomName}`);
    });

    // Player movement
    socket.on('move', (pos) => {
        if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') return;

        for (let roomName in rooms) {
            const room = rooms[roomName];
            if (room.players[socket.id]) {
                room.players[socket.id].x = pos.x;
                room.players[socket.id].y = pos.y;
                io.to(roomName).emit('state', room.players);
                break;
            }
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`Disconnected: ${socket.id}`);

        for (let roomName in rooms) {
            const room = rooms[roomName];
            if (room.players[socket.id]) {
                delete room.players[socket.id];
                io.to(roomName).emit('state', room.players);
                break;
            }
        }
    });
});

// Start the server
server.listen(PORT, '1000', () => {
    console.log(`Server running on port ${PORT}  (Render uses process.env.PORT)`);
});
