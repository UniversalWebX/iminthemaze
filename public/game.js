const socket = io();

// Constants
const DEFAULT_GRID_SIZE = 20;
let CELL_SIZE = DEFAULT_GRID_SIZE;
const MOVE_SPEED = 5;

// Maze data structure
let maze = {
  width: 60,
  height: 40,
  cells: [],
  objects: [],
  start: {x: 2, y: 2},
  end: {x: 57, y: 37},
  gridSize: DEFAULT_GRID_SIZE
};

// Player class
class Player {
  constructor(id, x, y) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.keys = new Set();
    this.alive = true;
    this.inventory = new Set();
  }

  update() {
    this.vx = 0;
    this.vy = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) this.vx -= MOVE_SPEED;
    if (this.keys.has('d') || this.keys.has('arrowright')) this.vx += MOVE_SPEED;
    if (this.keys.has('w') || this.keys.has('arrowup')) this.vy -= MOVE_SPEED;
    if (this.keys.has('s') || this.keys.has('arrowdown')) this.vy += MOVE_SPEED;

    this.x += this.vx;
    this.y += this.vy;

    this.checkCollisions();
  }

  checkCollisions() {
    if (this.isCollidingWith('wall')) {
      this.x -= this.vx;
      this.y -= this.vy;
    }

    if (this.isCollidingWith('spike')) {
      this.alive = false;
    }

    maze.objects = maze.objects.filter(obj => {
      if (obj.type === 'key' && this.isCollidingWithObj(obj)) {
        this.inventory.add(obj.id);
        return false;
      }
      return true;
    });

    maze.objects.forEach(obj => {
      if (obj.type === 'door' && this.isCollidingWithObj(obj)) {
        if (this.inventory.has(obj.keyId)) {
          maze.objects = maze.objects.filter(o => o !== obj);
        } else {
          this.x -= this.vx;
          this.y -= this.vy;
        }
      }
      if (obj.type === 'portal' && this.isCollidingWithObj(obj)) {
        const pair = maze.objects.find(o => o.type === 'portal' && o.pairId === obj.id);
        if (pair) {
          this.x = pair.x;
          this.y = pair.y;
        }
      }
    });
  }

  isCollidingWith(type) {
    const cellX = Math.floor(this.x / CELL_SIZE);
    const cellY = Math.floor(this.y / CELL_SIZE);
    return this.isCellType(cellX, cellY, type) ||
           this.isCellType(cellX + 1, cellY, type) ||
           this.isCellType(cellX, cellY + 1, type) ||
           this.isCellType(cellX + 1, cellY + 1, type);
  }

  isCollidingWithObj(obj) {
    return Math.hypot(obj.x - this.x, obj.y - this.y) < CELL_SIZE * 1.2;
  }

  isCellType(x, y, type) {
    return maze.cells[y] && maze.cells[y][x] === type;
  }
}

// Editor variables
let currentTool = 'wall';
let selectedObject = null;
let drawing = false;
let portalCounter = 0;
let doorKeyCounter = 0;

// Canvases & contexts
const editorCanvas = document.getElementById('editor-canvas');
const playCanvas = document.getElementById('play-canvas');
let editorCtx, playCtx;

// Mode flags
let isEditor = false;
let isSingleplayer = false;
let isMultiplayer = false;
let roomId = null;
let players = {};

// Init maze
function initMaze() {
  maze.cells = Array.from({length: maze.height}, () => Array(maze.width).fill(null));
}

// Resize canvas dynamically
function updateCanvasSizes() {
  const viewWidth = window.innerWidth * 0.8;
  const viewHeight = window.innerHeight * 0.7;
  const scaleX = viewWidth / (maze.width * maze.gridSize);
  const scaleY = viewHeight / (maze.height * maze.gridSize);
  CELL_SIZE = maze.gridSize * Math.min(scaleX, scaleY, 1.5); // cap max size

  const w = maze.width * CELL_SIZE;
  const h = maze.height * CELL_SIZE;

  if (isEditor) {
    editorCanvas.width = w;
    editorCanvas.height = h;
  } else if (isSingleplayer || isMultiplayer) {
    playCanvas.width = w;
    playCanvas.height = h;
  }
}

window.addEventListener('resize', updateCanvasSizes);

// Draw functions (simplified version - expand as needed)
function drawMaze(ctx) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Grid
  ctx.strokeStyle = '#1a1a2e';
  for (let i = 0; i <= maze.width; i++) {
    ctx.beginPath();
    ctx.moveTo(i * CELL_SIZE, 0);
    ctx.lineTo(i * CELL_SIZE, ctx.canvas.height);
    ctx.stroke();
  }
  for (let i = 0; i <= maze.height; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * CELL_SIZE);
    ctx.lineTo(ctx.canvas.width, i * CELL_SIZE);
    ctx.stroke();
  }

  // Cells
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      const type = maze.cells[y][x];
      if (type === 'wall') {
        ctx.fillStyle = '#5dade2';
        ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      } else if (type === 'spike') {
        ctx.fillStyle = '#ff00ff';
        ctx.beginPath();
        ctx.moveTo(x * CELL_SIZE + CELL_SIZE/2, y * CELL_SIZE);
        ctx.lineTo(x * CELL_SIZE, y * CELL_SIZE + CELL_SIZE);
        ctx.lineTo(x * CELL_SIZE + CELL_SIZE, y * CELL_SIZE + CELL_SIZE);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // Objects
  maze.objects.forEach(obj => {
    ctx.save();
    ctx.translate(obj.x + CELL_SIZE/2, obj.y + CELL_SIZE/2);
    ctx.rotate((obj.rotation || 0) * Math.PI / 180);
    ctx.scale(obj.scale || 1, obj.scale || 1);
    ctx.translate(-CELL_SIZE/2, -CELL_SIZE/2);

    let color = '#ffffff';
    switch (obj.type) {
      case 'portal':   color = '#9b59b6'; break;
      case 'door':     color = '#e67e22'; break;
      case 'key':      color = '#f1c40f'; break;
      case 'start':    color = '#27ae60'; break;
      case 'end':      color = '#e74c3c'; break;
      case 'trigger-zipline': color = '#8888ff'; break;
    }
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, CELL_SIZE, CELL_SIZE);

    ctx.restore();
  });
}

function drawPlayers(ctx) {
  for (let id in players) {
    const p = players[id];
    if (!p.alive) continue;
    ctx.fillStyle = (id === (isSingleplayer ? 'local' : socket.id)) ? '#00ffff' : '#ff00ff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, CELL_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Editor click handling (simplified - expand for draw/rescale/rotate as needed)
function handleEditorClick(e, isDrag = false) {
  const rect = editorCanvas.getBoundingClientRect();
  let x = e.clientX - rect.left;
  let y = e.clientY - rect.top;

  if (maze.gridSize) {
    x = Math.round(x / CELL_SIZE) * CELL_SIZE;
    y = Math.round(y / CELL_SIZE) * CELL_SIZE;
  }

  const gridX = Math.round(x / CELL_SIZE);
  const gridY = Math.round(y / CELL_SIZE);

  if (currentTool === 'draw') {
    if (gridY >= 0 && gridY < maze.height && gridX >= 0 && gridX < maze.width) {
      maze.cells[gridY][gridX] = 'wall';
    }
  } else if (['wall', 'spike'].includes(currentTool)) {
    if (gridY >= 0 && gridY < maze.height && gridX >= 0 && gridX < maze.width) {
      maze.cells[gridY][gridX] = currentTool;
    }
  } else if (currentTool === 'start') {
    maze.start = {x: gridX, y: gridY};
    maze.objects = maze.objects.filter(o => o.type !== 'start');
    maze.objects.push({type: 'start', x, y, scale:1, rotation:0});
  } else if (currentTool === 'end') {
    maze.end = {x: gridX, y: gridY};
    maze.objects = maze.objects.filter(o => o.type !== 'end');
    maze.objects.push({type: 'end', x, y, scale:1, rotation:0});
  } else if (currentTool === 'portal') {
    const id = ++portalCounter;
    maze.objects.push({type: 'portal', x, y, scale:1, rotation:0, id, pairId: null});
    const unpaired = maze.objects.find(o => o.type === 'portal' && !o.pairId && o.id !== id);
    if (unpaired) {
      unpaired.pairId = id;
      maze.objects.find(o => o.id === id).pairId = unpaired.id;
    }
  } else if (currentTool === 'door') {
    const keyId = ++doorKeyCounter;
    maze.objects.push({type: 'door', x, y, scale:1, rotation:0, keyId});
  } else if (currentTool === 'key') {
    maze.objects.push({type: 'key', x, y, scale:1, rotation:0, keyId: doorKeyCounter});
  } else {
    maze.objects.push({type: currentTool, x, y, scale:1, rotation:0, id: Math.random()});
  }

  drawMaze(editorCtx);
}

editorCanvas.addEventListener('click', e => handleEditorClick(e));
editorCanvas.addEventListener('mousedown', e => { if (currentTool === 'draw') drawing = true; });
editorCanvas.addEventListener('mousemove', e => { if (drawing) handleEditorClick(e, true); });
editorCanvas.addEventListener('mouseup', () => drawing = false);

// Controls
document.addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  const player = players[isSingleplayer ? 'local' : socket.id];
  if (player) player.keys.add(key);
});

document.addEventListener('keyup', e => {
  const key = e.key.toLowerCase();
  const player = players[isSingleplayer ? 'local' : socket.id];
  if (player) player.keys.delete(key);
});

// Save Maze - generates Python-compatible JSON
document.getElementById('save-maze').addEventListener('click', () => {
  const exportData = {};

  // Objects
  maze.objects.forEach(obj => {
    const key = `obj_${Math.round(obj.x)}_${Math.round(obj.y)}`;
    exportData[key] = {
      type: obj.type,
      x: Math.round(obj.x),
      y: Math.round(obj.y),
      w: maze.gridSize,
      h: maze.gridSize,
      color: getToolColor(obj.type),
      rot: Math.round(obj.rotation || 0),
      linkId: obj.pairId || obj.keyId || ""
    };
  });

  // Cells → wall/spike objects
  for (let gy = 0; gy < maze.height; gy++) {
    for (let gx = 0; gx < maze.width; gx++) {
      const type = maze.cells[gy]?.[gx];
      if (type && type !== null) {
        const px = gx * maze.gridSize;
        const py = gy * maze.gridSize;
        const key = `obj_${px}_${py}`;
        if (!(key in exportData)) {
          exportData[key] = {
            type,
            x: px,
            y: py,
            w: maze.gridSize,
            h: maze.gridSize,
            color: getToolColor(type),
            rot: 0,
            linkId: ""
          };
        }
      }
    }
  }

  const json = JSON.stringify(exportData, null, 2);
  navigator.clipboard.writeText(json).then(() => {
    alert("Maze JSON copied to clipboard!\nPaste it in the play mode 'Load Pasted JSON' area.");
  }).catch(() => {
    alert("Copy failed. Please manually copy:\n\n" + json);
  });
});

function getToolColor(type) {
  const map = {
    wall: "#5dade2",
    spike: "#ff00ff",
    portal: "#9b59b6",
    door: "#e67e22",
    key: "#f1c40f",
    start: "#27ae60",
    end: "#e74c3c",
    "trigger-zipline": "#8888ff"
  };
  return map[type] || "#ffffff";
}

// Load pasted JSON (compatible with Python editor format)
document.getElementById('load-from-code').addEventListener('click', () => {
  const text = document.getElementById('load-json').value.trim();
  if (!text) return alert("Paste JSON first.");

  try {
    const data = JSON.parse(text);
    maze.cells = Array.from({length: maze.height}, () => Array(maze.width).fill(null));
    maze.objects = [];
    maze.start = null;
    maze.end = null;

    Object.values(data).forEach(item => {
      const gx = Math.floor(item.x / maze.gridSize);
      const gy = Math.floor(item.y / maze.gridSize);

      if (gx < 0 || gy < 0 || gx >= maze.width || gy >= maze.height) return;

      if (item.type === 'wall' || item.type === 'spike') {
        for (let dy = 0; dy < (item.h / maze.gridSize); dy++) {
          for (let dx = 0; dx < (item.w / maze.gridSize); dx++) {
            const cx = gx + dx;
            const cy = gy + dy;
            if (cx < maze.width && cy < maze.height) {
              maze.cells[cy][cx] = item.type;
            }
          }
        }
      } else {
        const obj = {
          type: item.type,
          x: item.x,
          y: item.y,
          scale: 1,
          rotation: item.rot || 0,
          id: Math.random().toString(36).slice(2)
        };

        if (item.linkId) {
          if (item.type === 'portal') obj.pairId = item.linkId;
          if (item.type === 'door' || item.type === 'key') obj.keyId = item.linkId;
        }

        if (item.type === 'start') maze.start = {x: gx, y: gy};
        if (item.type === 'end')   maze.end   = {x: gx, y: gy};

        maze.objects.push(obj);
      }
    });

    updateCanvasSizes();
    if (isEditor) {
      drawMaze(editorCtx);
    } else {
      const pid = isSingleplayer ? 'local' : socket.id;
      if (players[pid]) {
        players[pid].x = (maze.start?.x || 2) * CELL_SIZE + CELL_SIZE / 2;
        players[pid].y = (maze.start?.y || 2) * CELL_SIZE + CELL_SIZE / 2;
        players[pid].alive = true;
      }
      drawMaze(playCtx);
      drawPlayers(playCtx);
    }

    alert("Maze loaded from JSON!");
  } catch (err) {
    alert("Invalid JSON:\n" + err.message);
  }
});

// Game loop
function gameLoop() {
  if (isSingleplayer || isMultiplayer) {
    const localId = isSingleplayer ? 'local' : socket.id;
    const p = players[localId];
    if (p && p.alive) {
      p.update();

      if (maze.end) {
        const ex = maze.end.x * CELL_SIZE + CELL_SIZE / 2;
        const ey = maze.end.y * CELL_SIZE + CELL_SIZE / 2;
        if (Math.hypot(p.x - ex, p.y - ey) < CELL_SIZE) {
          alert("You win!");
          p.alive = false;
        }
      }

      if (isMultiplayer) {
        socket.emit('playerUpdate', {roomId, player: p});
      }
    }

    drawMaze(playCtx);
    drawPlayers(playCtx);
  }
  requestAnimationFrame(gameLoop);
}

// Mode switching
document.getElementById('editor-btn').addEventListener('click', () => {
  isEditor = true;
  document.getElementById('mode-selection').style.display = 'none';
  document.getElementById('editor').style.display = 'block';
  editorCtx = editorCanvas.getContext('2d');
  initMaze();
  updateCanvasSizes();
  drawMaze(editorCtx);
});

document.getElementById('singleplayer-btn').addEventListener('click', () => {
  isSingleplayer = true;
  document.getElementById('mode-selection').style.display = 'none';
  document.getElementById('play').style.display = 'block';
  playCtx = playCanvas.getContext('2d');
  const saved = localStorage.getItem('maze');
  if (saved) maze = JSON.parse(saved);
  initMaze();
  updateCanvasSizes();
  players.local = new Player('local', (maze.start?.x || 2) * CELL_SIZE + CELL_SIZE/2, (maze.start?.y || 2) * CELL_SIZE + CELL_SIZE/2);
  gameLoop();
});

document.getElementById('multiplayer-host-btn').addEventListener('click', () => {
  isMultiplayer = true;
  const saved = localStorage.getItem('maze');
  if (saved) maze = JSON.parse(saved);
  socket.emit('createRoom', maze);
});

socket.on('roomCreated', id => {
  roomId = id;
  alert(`Room ID: ${id}\nShare this with friends!`);
  startMultiplayer();
});

document.getElementById('multiplayer-join-btn').addEventListener('click', () => {
  document.getElementById('multiplayer-info').style.display = 'block';
});

document.getElementById('join-room').addEventListener('click', () => {
  roomId = document.getElementById('room-id').value.trim();
  if (roomId) socket.emit('joinRoom', roomId);
});

function startMultiplayer() {
  document.getElementById('mode-selection').style.display = 'none';
  document.getElementById('play').style.display = 'block';
  document.getElementById('multiplayer-info').style.display = 'none';
  playCtx = playCanvas.getContext('2d');
  initMaze();
  updateCanvasSizes();
  players[socket.id] = new Player(socket.id, (maze.start?.x || 2) * CELL_SIZE + CELL_SIZE/2, (maze.start?.y || 2) * CELL_SIZE + CELL_SIZE/2);
  gameLoop();
}

socket.on('mazeData', data => {
  maze = data;
  startMultiplayer();
});

socket.on('playersUpdate', updated => {
  players = {...updated};
});

socket.on('objectsUpdate', objs => {
  maze.objects = objs;
});

// Respawn
document.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 'r') {
    const p = players[isSingleplayer ? 'local' : socket.id];
    if (p && !p.alive) {
      p.alive = true;
      p.x = (maze.start?.x || 2) * CELL_SIZE + CELL_SIZE/2;
      p.y = (maze.start?.y || 2) * CELL_SIZE + CELL_SIZE/2;
      p.inventory.clear();
    }
  }
});
