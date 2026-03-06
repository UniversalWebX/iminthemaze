const socket = io();

// Constants
const CELL_SIZE = 20;
const GRAVITY = 0.5;
const JUMP_FORCE = -10;
const MOVE_SPEED = 5;
const WAVE_SPEED = 5;

// Maze data structure
let maze = {
  width: 50,
  height: 30,
  cells: [], // 2D array for walls, etc.
  objects: [], // {type, x, y, scale:1, rotation:0, id: unique, pairId: for portals, ...}
  start: {x:0, y:0},
  end: {x:49, y:29}
};

// Player
class Player {
  constructor(id, x, y) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.mode = 'person'; // 'person' or 'wave'
    this.gravityDir = 1; // 1 down, -1 up (but spec no flip)
    this.grounded = false;
    this.keys = new Set();
    this.alive = true;
    this.inventory = new Set(); // keys
  }

  update() {
    this.vx = 0;
    if (this.mode === 'person') {
      if (this.keys.has('a') || this.keys.has('arrowleft')) this.vx -= MOVE_SPEED;
      if (this.keys.has('d') || this.keys.has('arrowright')) this.vx += MOVE_SPEED;
      if (this.keys.has('w') || this.keys.has('arrowup')) {} // No up in person?
      if (this.keys.has('s') || this.keys.has('arrowdown')) {} // No down
      if (this.keys.has(' ') && this.grounded) {
        this.vy = JUMP_FORCE * this.gravityDir;
        this.grounded = false;
      }
      this.vy += GRAVITY * this.gravityDir;
    } else if (this.mode === 'wave') {
      if (this.keys.has('a') || this.keys.has('arrowleft')) this.vx -= MOVE_SPEED;
      if (this.keys.has('d') || this.keys.has('arrowright')) this.vx += MOVE_SPEED;
      if (this.keys.has(' ')) {
        this.vy = -WAVE_SPEED;
      } else {
        this.vy = WAVE_SPEED;
      }
    }

    this.x += this.vx;
    this.y += this.vy;

    // Collisions
    this.checkCollisions();
  }

  checkCollisions() {
    const cellX = Math.floor(this.x / CELL_SIZE);
    const cellY = Math.floor(this.y / CELL_SIZE);

    // Wall collision
    if (this.isCollidingWith('wall')) {
      this.x -= this.vx;
      this.y -= this.vy;
      this.vy = 0; // Stop vertical if hit
      this.grounded = this.isGrounded();
    }

    // Spike
    if (this.isCollidingWith('spike')) {
      this.alive = false;
    }

    // Keys
    maze.objects = maze.objects.filter(obj => {
      if (obj.type === 'key' && this.isCollidingWithObj(obj)) {
        this.inventory.add(obj.id);
        return false;
      }
      return true;
    });

    // Doors
    maze.objects.forEach(obj => {
      if (obj.type === 'door' && this.isCollidingWithObj(obj)) {
        if (this.inventory.has(obj.keyId)) {
          maze.objects = maze.objects.filter(o => o !== obj);
        } else {
          this.x -= this.vx;
          this.y -= this.vy;
        }
      }
    });

    // Portals
    maze.objects.forEach(obj => {
      if (obj.type === 'portal' && this.isCollidingWithObj(obj)) {
        const pair = maze.objects.find(o => o.type === 'portal' && o.pairId === obj.id);
        if (pair) {
          this.x = pair.x;
          this.y = pair.y;
        }
      }
    });

    // Triggers
    maze.objects.forEach(obj => {
      if (this.isCollidingWithObj(obj)) {
        switch (obj.type) {
          case 'trigger-person':
            this.mode = 'person';
            break;
          case 'trigger-wave':
            this.mode = 'wave';
            break;
          case 'trigger-gravity':
            if (this.mode !== 'wave') {
              while (!this.isGrounded()) {
                this.y += this.gravityDir * CELL_SIZE; // Drop by cell
              }
              this.vy = 0;
              this.grounded = true;
            }
            break;
        }
      }
    });

    this.grounded = this.isGrounded();
  }

  isGrounded() {
    const checkY = this.y + (CELL_SIZE / 2 + 1) * this.gravityDir;
    const cellY = Math.floor(checkY / CELL_SIZE);
    const cellX = Math.floor(this.x / CELL_SIZE);
    return this.isCellType(cellX, cellY, 'wall');
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
    return Math.hypot(obj.x - this.x, obj.y - this.y) < CELL_SIZE;
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

// Canvases
const editorCanvas = document.getElementById('editor-canvas');
const playCanvas = document.getElementById('play-canvas');
let editorCtx, playCtx;

// Mode flags
let isEditor = false;
let isSingleplayer = false;
let isMultiplayer = false;
let roomId = null;
let players = {};

// Init maze cells
function initMaze() {
  maze.cells = Array.from({length: maze.height}, () => Array(maze.width).fill(null));
}

// Resize maze
document.getElementById('resize-maze').addEventListener('click', () => {
  const newWidth = parseInt(prompt('New width:', maze.width)) || maze.width;
  const newHeight = parseInt(prompt('New height:', maze.height)) || maze.height;
  maze.width = newWidth;
  maze.height = newHeight;
  initMaze();
  resizeCanvas(editorCanvas, maze.width, maze.height);
  drawMaze(editorCtx);
});

// Resize canvas
function resizeCanvas(canvas, width, height) {
  canvas.width = width * CELL_SIZE;
  canvas.height = height * CELL_SIZE;
}

// Draw maze
function drawMaze(ctx) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      if (maze.cells[y][x] === 'wall') {
        ctx.fillStyle = '#000';
        ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      } else if (maze.cells[y][x] === 'spike') {
        ctx.fillStyle = '#f00';
        ctx.beginPath();
        ctx.moveTo(x * CELL_SIZE, (y + 1) * CELL_SIZE);
        ctx.lineTo((x + 0.5) * CELL_SIZE, y * CELL_SIZE);
        ctx.lineTo((x + 1) * CELL_SIZE, (y + 1) * CELL_SIZE);
        ctx.fill();
      }
    }
  }
  maze.objects.forEach(obj => {
    ctx.save();
    ctx.translate(obj.x + CELL_SIZE / 2, obj.y + CELL_SIZE / 2);
    ctx.rotate(obj.rotation * Math.PI / 180);
    ctx.scale(obj.scale, obj.scale);
    ctx.translate(-CELL_SIZE / 2, -CELL_SIZE / 2);
    switch (obj.type) {
      case 'portal':
        ctx.fillStyle = '#00f';
        ctx.fillRect(0, 0, CELL_SIZE, CELL_SIZE);
        break;
      case 'door':
        ctx.fillStyle = '#800';
        ctx.fillRect(0, 0, CELL_SIZE, CELL_SIZE);
        break;
      case 'key':
        ctx.fillStyle = '#ff0';
        ctx.beginPath();
        ctx.arc(CELL_SIZE / 2, CELL_SIZE / 2, CELL_SIZE / 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'trigger-person':
        ctx.fillStyle = '#0f0';
        ctx.fillRect(0, 0, CELL_SIZE, CELL_SIZE);
        break;
      case 'trigger-wave':
        ctx.fillStyle = '#0ff';
        ctx.fillRect(0, 0, CELL_SIZE, CELL_SIZE);
        break;
      case 'trigger-gravity':
        ctx.fillStyle = '#f0f';
        ctx.fillRect(0, 0, CELL_SIZE, CELL_SIZE);
        break;
      case 'trigger-zipline':
        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.arc(CELL_SIZE / 2, CELL_SIZE / 2, CELL_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      // start and end as circles or something
      case 'start':
        ctx.fillStyle = '#0f0';
        ctx.beginPath();
        ctx.arc(CELL_SIZE / 2, CELL_SIZE / 2, CELL_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'end':
        ctx.fillStyle = '#f00';
        ctx.beginPath();
        ctx.arc(CELL_SIZE / 2, CELL_SIZE / 2, CELL_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
    ctx.restore();
  });
}

// Draw players
function drawPlayers(ctx) {
  for (let id in players) {
    const p = players[id];
    if (!p.alive) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.mode === 'person') {
      ctx.fillStyle = id === (isSingleplayer ? 'local' : socket.id) ? '#00f' : '#0f0';
      ctx.fillRect(-CELL_SIZE / 2, -CELL_SIZE / 2, CELL_SIZE, CELL_SIZE);
    } else {
      ctx.fillStyle = id === (isSingleplayer ? 'local' : socket.id) ? '#00f' : '#0f0';
      ctx.beginPath();
      ctx.moveTo(-CELL_SIZE / 2, 0);
      ctx.lineTo(0, -CELL_SIZE / 2);
      ctx.lineTo(CELL_SIZE / 2, 0);
      ctx.lineTo(0, CELL_SIZE / 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

// Editor event listeners
editorCanvas.addEventListener('mousedown', (e) => {
  if (currentTool === 'draw') {
    drawing = true;
  }
  handleEditorClick(e);
});

editorCanvas.addEventListener('mousemove', (e) => {
  if (drawing && currentTool === 'draw') {
    handleEditorClick(e);
  }
});

editorCanvas.addEventListener('mouseup', () => {
  drawing = false;
});

function handleEditorClick(e) {
  const rect = editorCanvas.getBoundingClientRect();
  const gridX = Math.floor((e.clientX - rect.left) / CELL_SIZE);
  const gridY = Math.floor((e.clientY - rect.top) / CELL_SIZE);
  const x = gridX * CELL_SIZE;
  const y = gridY * CELL_SIZE;

  if (currentTool === 'draw') {
    maze.cells[gridY][gridX] = 'wall';
  } else if (currentTool === 'rescale' || currentTool === 'rotate') {
    selectedObject = maze.objects.find(obj => Math.abs(obj.x - x) < CELL_SIZE && Math.abs(obj.y - y) < CELL_SIZE);
    if (selectedObject) {
      if (currentTool === 'rescale') {
        selectedObject.scale = parseFloat(prompt('New scale:', selectedObject.scale)) || 1;
      } else {
        selectedObject.rotation = parseFloat(prompt('New rotation (degrees):', selectedObject.rotation)) || 0;
      }
    }
  } else if (currentTool === 'start') {
    maze.start = {x: gridX, y: gridY};
    maze.objects = maze.objects.filter(obj => obj.type !== 'start');
    maze.objects.push({type: 'start', x, y, scale:1, rotation:0});
  } else if (currentTool === 'end') {
    maze.end = {x: gridX, y: gridY};
    maze.objects = maze.objects.filter(obj => obj.type !== 'end');
    maze.objects.push({type: 'end', x, y, scale:1, rotation:0});
  } else if (currentTool === 'portal') {
    const id = ++portalCounter;
    maze.objects.push({type: 'portal', x, y, scale:1, rotation:0, id, pairId: null});
    // Pair with last unpaired
    const unpaired = maze.objects.find(o => o.type === 'portal' && o.pairId === null && o.id !== id);
    if (unpaired) {
      unpaired.pairId = id;
      maze.objects.find(o => o.id === id).pairId = unpaired.id;
    }
  } else if (currentTool === 'door') {
    const keyId = ++doorKeyCounter;
    // Prompt for key position? But for simplicity, place door, key separately, link by id
    maze.objects.push({type: 'door', x, y, scale:1, rotation:0, keyId});
  } else if (currentTool === 'key') {
    const keyId = doorKeyCounter; // Assume last door's key
    maze.objects.push({type: 'key', x, y, scale:1, rotation:0, id: keyId});
  } else if (['wall', 'spike'].includes(currentTool)) {
    maze.cells[gridY][gridX] = currentTool;
  } else {
    maze.objects.push({type: currentTool, x, y, scale:1, rotation:0, id: Math.random()});
  }
  drawMaze(editorCtx);
}

// Play controls
document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase() === ' ' ? ' ' : e.key.toLowerCase();
  const localPlayer = players[isSingleplayer ? 'local' : socket.id];
  if (localPlayer) {
    localPlayer.keys.add(key);
  }
});

document.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase() === ' ' ? ' ' : e.key.toLowerCase();
  const localPlayer = players[isSingleplayer ? 'local' : socket.id];
  if (localPlayer) {
    localPlayer.keys.delete(key);
  }
});

// Zipline click
playCanvas.addEventListener('click', (e) => {
  if (isSingleplayer || isMultiplayer) {
    const rect = playCanvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const localPlayer = players[isSingleplayer ? 'local' : socket.id];
    maze.objects = maze.objects.filter(obj => {
      if (obj.type === 'trigger-zipline' && Math.hypot(obj.x + CELL_SIZE/2 - clickX, obj.y + CELL_SIZE/2 - clickY) < CELL_SIZE / 2) {
        if (lineOfSight(localPlayer.x, localPlayer.y, obj.x + CELL_SIZE/2, obj.y + CELL_SIZE/2)) {
          localPlayer.vx = 0;
          localPlayer.vy = 0;
          localPlayer.x = obj.x + CELL_SIZE/2;
          localPlayer.y = obj.y + CELL_SIZE/2;
          if (isMultiplayer) {
            socket.emit('objectUpdate', {roomId, objects: maze.objects});
          }
          return false; // Remove one-time
        }
      }
      return true;
    });
  }
});

function lineOfSight(x0, y0, x1, y1) {
  // Bresenham's line algorithm to check for walls
  x0 = Math.floor(x0 / CELL_SIZE);
  y0 = Math.floor(y0 / CELL_SIZE);
  x1 = Math.floor(x1 / CELL_SIZE);
  y1 = Math.floor(y1 / CELL_SIZE);

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    if (maze.cells[y0] && maze.cells[y0][x0] === 'wall') {
      return false;
    }
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
  return true;
}

// Game loop
let lastTime = 0;
function gameLoop(time) {
  requestAnimationFrame(gameLoop);
  if (isSingleplayer || isMultiplayer) {
    const delta = (time - lastTime) / 1000;
    lastTime = time;
    const localId = isSingleplayer ? 'local' : socket.id;
    const localPlayer = players[localId];
    if (localPlayer && localPlayer.alive) {
      localPlayer.update();
      // Check win
      const endObj = maze.objects.find(o => o.type === 'end');
      if (endObj && Math.hypot(localPlayer.x - (endObj.x + CELL_SIZE/2), localPlayer.y - (endObj.y + CELL_SIZE/2)) < CELL_SIZE) {
        alert('You win!');
        localPlayer.alive = false;
      }
      if (isMultiplayer) {
        socket.emit('playerUpdate', {roomId, player: localPlayer});
      }
    }
    drawMaze(playCtx);
    drawPlayers(playCtx);
  }
}

// AI build
document.getElementById('ai-build').addEventListener('click', async () => {
  const prompt = document.getElementById('ai-prompt').value || 'Generate a maze as JSON: {width:50, height:30, cells:2D array of null/"wall"/"spike", objects:[{type:"portal"/"door"/"key"/"trigger-person"/etc, x:int*CELL_SIZE, y:int*CELL_SIZE, scale:1, rotation:0, id:?, pairId:for portals, keyId:for doors/keys}], start:{x:0,y:0}, end:{x:49,y:29}}';
  // Replace with your API key
  const API_KEY = 'AIzaSyBnfIO9jE0ZN-q2qnX1x6cN2zz7rIDRetE';
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        contents: [{parts: [{text: prompt}]}]
      })
    });
    const data = await response.json();
    const aiMazeText = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
    const aiMaze = JSON.parse(aiMazeText);
    maze = aiMaze;
    initMaze();
    // Fill cells from aiMaze.cells
    maze.cells = aiMaze.cells;
    resizeCanvas(editorCanvas, maze.width, maze.height);
    drawMaze(editorCtx);
  } catch (error) {
    console.error('AI error:', error);
  }
});

// Tool buttons
document.querySelectorAll('#tools button[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => {
    currentTool = btn.dataset.tool;
  });
});

// Save/load
document.getElementById('save-maze').addEventListener('click', () => {
  localStorage.setItem('maze', JSON.stringify(maze));
});
document.getElementById('load-maze').addEventListener('click', () => {
  const saved = localStorage.getItem('maze');
  if (saved) {
    maze = JSON.parse(saved);
    initMaze();
    maze.cells = maze.cells; // Already set
    resizeCanvas(editorCanvas, maze.width, maze.height);
    drawMaze(editorCtx);
  }
});

// Mode buttons
document.getElementById('editor-btn').addEventListener('click', () => {
  isEditor = true;
  document.getElementById('mode-selection').style.display = 'none';
  document.getElementById('editor').style.display = 'block';
  editorCtx = editorCanvas.getContext('2d');
  initMaze();
  resizeCanvas(editorCanvas, maze.width, maze.height);
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
  maze.cells = maze.cells;
  resizeCanvas(playCanvas, maze.width, maze.height);
  players['local'] = new Player('local', maze.start.x * CELL_SIZE + CELL_SIZE/2, maze.start.y * CELL_SIZE + CELL_SIZE/2);
  gameLoop(0);
});

document.getElementById('multiplayer-host-btn').addEventListener('click', () => {
  isMultiplayer = true;
  const saved = localStorage.getItem('maze');
  if (saved) maze = JSON.parse(saved);
  socket.emit('createRoom', maze);
});

socket.on('roomCreated', (id) => {
  roomId = id;
  alert(`Room created: ${id}`);
  startMultiplayer();
});

document.getElementById('multiplayer-join-btn').addEventListener('click', () => {
  document.getElementById('multiplayer-info').style.display = 'block';
  document.getElementById('join-room').addEventListener('click', () => {
    roomId = document.getElementById('room-id').value;
    socket.emit('joinRoom', roomId);
  }, {once: true});
});

socket.on('mazeData', (data) => {
  maze = data;
  startMultiplayer();
});

function startMultiplayer() {
  document.getElementById('mode-selection').style.display = 'none';
  document.getElementById('play').style.display = 'block';
  document.getElementById('multiplayer-info').style.display = 'none';
  playCtx = playCanvas.getContext('2d');
  initMaze();
  maze.cells = maze.cells;
  resizeCanvas(playCanvas, maze.width, maze.height);
  players[socket.id] = new Player(socket.id, maze.start.x * CELL_SIZE + CELL_SIZE/2, maze.start.y * CELL_SIZE + CELL_SIZE/2);
  gameLoop(0);
}

socket.on('playersUpdate', (updatedPlayers) => {
  players = {...updatedPlayers};
  players[socket.id] = players[socket.id] || new Player(socket.id, maze.start.x * CELL_SIZE + CELL_SIZE/2, maze.start.y * CELL_SIZE + CELL_SIZE/2);
});

socket.on('objectsUpdate', (updatedObjects) => {
  maze.objects = updatedObjects;
});

// Additional features: camera follow player? But for now, full maze view.
// Death respawn? Alert and respawn.
document.addEventListener('keydown', (e) => {
  if (e.key === 'r') {
    const localPlayer = players[isSingleplayer ? 'local' : socket.id];
    if (localPlayer && !localPlayer.alive) {
      localPlayer.alive = true;
      localPlayer.x = maze.start.x * CELL_SIZE + CELL_SIZE/2;
      localPlayer.y = maze.start.y * CELL_SIZE + CELL_SIZE/2;
      localPlayer.vx = 0;
      localPlayer.vy = 0;
      localPlayer.inventory.clear();
    }
  }
});
