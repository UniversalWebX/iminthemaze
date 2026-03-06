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

let toolColors = {
  wall:           '#5dade2',
  portal:         '#9b59b6',
  door:           '#e67e22',
  key:            '#f1c40f',
  spike:          '#ff3366',
  'trigger-zipline': '#88aaff',
  start:          '#27ae60',
  end:            '#e74c3c',
  draw:           '#00ffcc'
};

let currentColor = '#00ffcc';

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

// Init
function initMaze() {
  maze.cells = Array.from({length: maze.height}, () => Array(maze.width).fill(null));
}

// Resize
function updateCanvasSizes() {
  const viewWidth = window.innerWidth * 0.8;
  const viewHeight = window.innerHeight * 0.7;
  const scaleX = viewWidth / (maze.width * maze.gridSize);
  const scaleY = viewHeight / (maze.height * maze.gridSize);
  CELL_SIZE = maze.gridSize * Math.min(scaleX, scaleY, 1.5);

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

// Color picker setup
document.getElementById('tool-color').value = currentColor;

document.getElementById('apply-color').addEventListener('click', () => {
  currentColor = document.getElementById('tool-color').value;
  if (currentTool in toolColors) {
    toolColors[currentTool] = currentColor;
  }
  if (selectedObject) {
    selectedObject.color = currentColor;
  }
  drawMaze(editorCtx);
});

// Draw maze with vector icons
function drawMaze(ctx) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Grid
  ctx.strokeStyle = 'rgba(0, 255, 204, 0.12)';
  ctx.lineWidth = 1;
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
      const type = maze.cells[y]?.[x];
      if (!type) continue;
      const px = x * CELL_SIZE;
      const py = y * CELL_SIZE;
      const s = CELL_SIZE;

      ctx.save();
      if (type === 'wall') {
        ctx.fillStyle = toolColors.wall;
        ctx.fillRect(px, py, s, s);
        ctx.strokeStyle = '#ffffff33';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 2, py + 2, s - 4, s - 4);
      } else if (type === 'spike') {
        ctx.fillStyle = toolColors.spike;
        ctx.beginPath();
        ctx.moveTo(px + s/2, py + s*0.2);
        ctx.lineTo(px + s*0.15, py + s*0.8);
        ctx.lineTo(px + s*0.85, py + s*0.8);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // Objects
  maze.objects.forEach(obj => {
    const px = obj.x;
    const py = obj.y;
    const s = CELL_SIZE * (obj.scale || 1);
    const cx = px + s/2;
    const cy = py + s/2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((obj.rotation || 0) * Math.PI / 180);
    ctx.scale(obj.scale || 1, obj.scale || 1);
    ctx.translate(-s/2, -s/2);

    ctx.lineWidth = Math.max(1.5, s * 0.08);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const col = obj.color || getToolColor(obj.type);

    switch (obj.type) {
      case 'portal':
        ctx.strokeStyle = col;
        ctx.fillStyle = 'transparent';
        ctx.beginPath();
        ctx.arc(s/2, s/2, s*0.45, 0, Math.PI*2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(s/2, s/2, s*0.25, 0, Math.PI*2);
        ctx.stroke();
        break;
      case 'door':
        ctx.fillStyle = col;
        ctx.fillRect(s*0.15, s*0.1, s*0.7, s*0.8);
        ctx.strokeStyle = '#00000088';
        ctx.strokeRect(s*0.15, s*0.1, s*0.7, s*0.8);
        ctx.beginPath();
        ctx.moveTo(s*0.5, s*0.3);
        ctx.lineTo(s*0.5, s*0.7);
        ctx.stroke();
        break;
      case 'key':
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(s/2, s/2, s*0.35, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(s*0.65, s/2);
        ctx.lineTo(s*0.9, s*0.3);
        ctx.lineTo(s*0.95, s*0.45);
        ctx.lineTo(s*0.7, s/2);
        ctx.closePath();
        ctx.fill();
        break;
      case 'start':
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(s/2, s*0.2);
        ctx.lineTo(s*0.3, s*0.8);
        ctx.lineTo(s*0.7, s*0.8);
        ctx.closePath();
        ctx.fill();
        break;
      case 'end':
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(s/2, s/2, s*0.4, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(s/2, s/2, s*0.22, 0, Math.PI*2);
        ctx.fill();
        break;
      case 'trigger-zipline':
        ctx.strokeStyle = col;
        ctx.beginPath();
        ctx.moveTo(s*0.2, s*0.5);
        ctx.lineTo(s*0.8, s*0.5);
        ctx.moveTo(s*0.35, s*0.3);
        ctx.lineTo(s*0.35, s*0.7);
        ctx.moveTo(s*0.65, s*0.3);
        ctx.lineTo(s*0.65, s*0.7);
        ctx.stroke();
        break;
    }
    ctx.restore();

    if (selectedObject === obj) {
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 3;
      ctx.strokeRect(px, py, s, s);
    }
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

// Hit detection
function getObjectAt(mx, my) {
  for (let obj of maze.objects) {
    const s = CELL_SIZE * (obj.scale || 1);
    if (mx >= obj.x && mx <= obj.x + s &&
        my >= obj.y && my <= obj.y + s) {
      return obj;
    }
  }
  const gx = Math.floor(mx / CELL_SIZE);
  const gy = Math.floor(my / CELL_SIZE);
  if (gx >= 0 && gx < maze.width && gy >= 0 && gy < maze.height) {
    if (maze.cells[gy][gx]) {
      return { type: maze.cells[gy][gx], isCell: true, gx, gy };
    }
  }
  return null;
}

// Editor input handling
function handleEditorClick(e, isDrag = false) {
  const rect = editorCanvas.getBoundingClientRect();
  let mx = e.clientX - rect.left;
  let my = e.clientY - rect.top;

  const snapX = Math.round(mx / CELL_SIZE) * CELL_SIZE;
  const snapY = Math.round(my / CELL_SIZE) * CELL_SIZE;

  const obj = getObjectAt(mx, my);

  if (currentTool === 'select') {
    selectedObject = obj && !obj.isCell ? obj : null;
    drawMaze(editorCtx);
    return;
  }

  if (currentTool === 'erase') {
    if (obj) {
      if (obj.isCell) {
        maze.cells[obj.gy][obj.gx] = null;
      } else {
        maze.objects = maze.objects.filter(o => o !== obj);
      }
    }
    drawMaze(editorCtx);
    return;
  }

  if (currentTool === 'draw') {
    const gx = Math.floor(mx / CELL_SIZE);
    const gy = Math.floor(my / CELL_SIZE);
    if (gx >= 0 && gx < maze.width && gy >= 0 && gy < maze.height) {
      maze.cells[gy][gx] = 'wall';
      drawMaze(editorCtx);
    }
    return;
  }

  // Place new object
  if (['wall','spike','portal','door','key','start','end','trigger-zipline'].includes(currentTool)) {
    if (currentTool === 'start') {
      maze.start = {x: Math.round(snapX / CELL_SIZE), y: Math.round(snapY / CELL_SIZE)};
    }
    if (currentTool === 'end') {
      maze.end = {x: Math.round(snapX / CELL_SIZE), y: Math.round(snapY / CELL_SIZE)};
    }

    const newObj = {
      type: currentTool,
      x: snapX,
      y: snapY,
      scale: 1,
      rotation: 0,
      color: currentColor || toolColors[currentTool],
      id: Math.random().toString(36).slice(2)
    };

    if (currentTool === 'portal') {
      const unpaired = maze.objects.find(o => o.type === 'portal' && !o.pairId);
      if (unpaired) {
        unpaired.pairId = newObj.id;
        newObj.pairId = unpaired.id;
      }
    }

    maze.objects.push(newObj);
    drawMaze(editorCtx);
  }
}

editorCanvas.addEventListener('click', e => handleEditorClick(e));
editorCanvas.addEventListener('mousedown', () => { drawing = currentTool === 'draw'; });
editorCanvas.addEventListener('mousemove', e => { if (drawing) handleEditorClick(e); });
editorCanvas.addEventListener('mouseup', () => drawing = false);

// ... (rest of the file: save-maze, load-from-code, game loop, mode switching, multiplayer sync, etc.)
// Note: The rest remains identical to the previous full version I gave you.
// If you need the complete game.js including save/load/game loop/player update/etc., just say so — I can paste the entire 400+ line file again.
