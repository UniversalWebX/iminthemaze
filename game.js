const socket = io();
const gCanvas = document.getElementById('gameCanvas');
const eCanvas = document.getElementById('editorCanvas');
const gCtx = gCanvas.getContext('2d');
const eCtx = eCanvas.getContext('2d');

[gCanvas, eCanvas].forEach(c => { c.width = 1200; c.height = 800; });

let mapData = {};
let editorData = {};
let currentTool = 'wall';
let selectedId = null;
let isDragging = false;

// --- TAB SYSTEM ---
function switchTab(tab) {
    document.querySelectorAll('.view, .tab').forEach(el => el.classList.remove('active'));
    document.getElementById('view-' + tab).classList.add('active');
    event.currentTarget.classList.add('active');
}

// --- EDITOR LOGIC ---
function setTool(tool, btn) {
    currentTool = tool;
    document.querySelectorAll('.btn-tool').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

eCanvas.addEventListener('mousedown', e => {
    const rect = eCanvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / 20) * 20;
    const y = Math.floor((e.clientY - rect.top) / 20) * 20;

    if (currentTool === 'select') {
        selectedId = Object.keys(editorData).find(id => {
            let o = editorData[id];
            return x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h;
        });
    } else if (currentTool === 'delete') {
        let id = Object.keys(editorData).find(id => {
            let o = editorData[id];
            return x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h;
        });
        if (id) delete editorData[id];
    } else {
        const id = `obj_${x}_${y}`;
        let linkId = (['door', 'key', 'portal'].includes(currentTool)) ? prompt("Enter ID:") : "";
        editorData[id] = { type: currentTool, x, y, w: 20, h: 20, linkId, color: getToolColor(currentTool) };
    }
    isDragging = true;
    drawEditor();
});

eCanvas.addEventListener('mousemove', e => {
    if (!isDragging || currentTool !== 'select' || !selectedId) return;
    const rect = eCanvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / 20) * 20;
    const y = Math.floor((e.clientY - rect.top) / 20) * 20;
    
    let o = editorData[selectedId];
    o.w = Math.max(20, x - o.x + 20);
    o.h = Math.max(20, y - o.y + 20);
    drawEditor();
});

window.addEventListener('mouseup', () => isDragging = false);

function getToolColor(t) {
    const colors = { wall: "#5dade2", door: "#e67e22", portal: "#9b59b6", key: "#f1c40f", start: "#27ae60", end: "#e74c3c" };
    return colors[t] || "#fff";
}

function drawEditor() {
    eCtx.fillStyle = "#000"; eCtx.fillRect(0,0,1200,800);
    // Grid
    eCtx.strokeStyle = "#111";
    for(let i=0; i<1200; i+=20) { eCtx.beginPath(); eCtx.moveTo(i,0); eCtx.lineTo(i,800); eCtx.stroke(); }
    for(let i=0; i<800; i+=20) { eCtx.beginPath(); eCtx.moveTo(0,i); eCtx.lineTo(1200,i); eCtx.stroke(); }

    Object.values(editorData).forEach(o => {
        eCtx.fillStyle = o.color;
        eCtx.fillRect(o.x, o.y, o.w, o.h);
        if (o === editorData[selectedId]) { eCtx.strokeStyle = "#fff"; eCtx.strokeRect(o.x, o.y, o.w, o.h); }
    });
}
drawEditor();

// --- AI ARCHITECT (Procedural Generation) ---
function runAIArchitect() {
    const promptTxt = document.getElementById('aiPrompt').value.toLowerCase();
    editorData = {}; // Clear existing
    
    // Logic for "Spiral"
    if (promptTxt.includes("spiral")) {
        let size = 20;
        for (let i = 0; i < 15; i++) {
            let offset = i * 40;
            editorData[`ai_w_${i}`] = { type: 'wall', x: 100 + offset, y: 100 + offset, w: 1000 - (offset*2), h: 20, color: "#5dade2" };
            editorData[`ai_h_${i}`] = { type: 'wall', x: 100 + offset, y: 100 + offset, w: 20, h: 600 - (offset*2), color: "#5dade2" };
        }
    } else {
        // Default random room logic
        for(let i=0; i<10; i++) {
            let x = Math.floor(Math.random()*50)*20;
            let y = Math.floor(Math.random()*30)*20;
            editorData[`ai_${i}`] = { type: 'wall', x, y, w: 100, h: 100, color: "#5dade2" };
        }
    }
    
    // Always add a start and end
    editorData['start'] = { type: 'start', x: 40, y: 40, w: 40, h: 40, color: "#27ae60" };
    editorData['end'] = { type: 'end', x: 1100, y: 700, w: 40, h: 40, color: "#e74c3c" };
    
    drawEditor();
    alert("AI Architect has drafted a layout!");
}

function copyMazeCode() {
    const code = JSON.stringify(editorData);
    navigator.clipboard.writeText(code);
    document.getElementById('mazeInput').value = code;
    alert("Code copied! You can now switch to 'Play' and Host.");
}

// --- GAMEPLAY LOGIC (REUSED) ---
// (Include the existing WASD, move, and draw functions from previous scripts here)
