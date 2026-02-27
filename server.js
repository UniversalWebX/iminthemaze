const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, { cors: { origin: "*" } });
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Replace with your actual key from Google AI Studio
const genAI = new GoogleGenerativeAI("YOUR_GEMINI_API_KEY");

app.use(express.static(__dirname));

let rooms = {};

io.on('connection', (socket) => {
    socket.emit('roomList', Object.keys(rooms));

    // --- SECURE AI GENERATION ---
    socket.on('askAI', async (prompt) => {
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const aiPrompt = `Generate a JSON object for a 1200x800 maze game. 
            Grid snap: 20px. Objects: {type: "wall"|"door"|"key"|"portal"|"start"|"end", x, y, w, h, color, linkId}. 
            User request: "${prompt}". Return ONLY the raw JSON object.`;
            
            const result = await model.generateContent(aiPrompt);
            const response = await result.response;
            const text = response.text().replace(/```json|```/g, "").trim();
            
            socket.emit('aiResponse', JSON.parse(text));
        } catch (error) {
            console.error("AI Error:", error);
            socket.emit('aiError', "AI failed to generate maze.");
        }
    });

    socket.on('createRoom', (data) => {
        if (!data.roomName) return;
        rooms[data.roomName] = { mapData: data.mapData, players: {} };
        io.emit('roomList', Object.keys(rooms));
    });

    socket.on('joinRoom', (data) => {
        if (rooms[data.roomName]) {
            socket.join(data.roomName);
            rooms[data.roomName].players[socket.id] = { 
                x: 0, y: 0, username: data.username || "Player", color: "#00ffcc", inventory: [] 
            };
            socket.emit('mapUpdate', rooms[data.roomName].mapData);
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

const PORT = process.env.PORT || 1000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server on port ${PORT}`));
