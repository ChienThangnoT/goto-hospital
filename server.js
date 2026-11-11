'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT) || 3000;
const MAX_PLAYERS = 80;
const GAME_FILE = path.join(__dirname, 'a.html');
const clients = new Map();

function safeText(value, maxLength) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength)
    : '';
}

function safeWord(value, fallback) {
  const word = safeText(value, 24);
  return /^[\w -]*$/.test(word) ? (word || fallback) : fallback;
}

function safeColor(value, fallback) {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value : fallback;
}

function safeApp(app) {
  if (!app || typeof app !== 'object' || Array.isArray(app)) return null;
  return {
    skin: safeColor(app.skin, '#f2c9a0'),
    hair: safeWord(app.hair, 'short'),
    hairColor: safeColor(app.hairColor, '#49352a'),
    outfit: safeWord(app.outfit, 'shirt'),
    color: safeColor(app.color, '#3a72c4'),
    pants: safeColor(app.pants, '#34495e'),
    gender: safeWord(app.gender, 'nam'),
    acc: safeText(app.acc, 60).replace(/[^\w ,'-]/g, ''),
    build: safeWord(app.build, ''),
    short: app.short === true,
    item: safeWord(app.item, '')
  };
}

function safePosition(value, min, max) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
}

function makePlayer(id, input, previous) {
  const player = previous || {};
  if (!previous) {
    const name = safeText(input.name, 24);
    if (!name || !safeApp(input.app)) return null;
    player.id = id;
    player.name = name;
    player.app = safeApp(input.app);
  }
  player.x = safePosition(input.x, 0, 10000);
  player.y = safePosition(input.y, 0, 10000);
  player.dir = Number.isInteger(input.dir) ? Math.min(3, Math.max(0, input.dir)) : 0;
  player.frame = Number.isInteger(input.frame) ? Math.min(4, Math.max(0, input.frame)) : 0;
  player.moving = input.moving === true;
  return player;
}

function send(socket, message) {
  if (socket.readyState === WebSocket.OPEN && socket.bufferedAmount < 65536) {
    socket.send(JSON.stringify(message));
  }
}

function broadcast(message, except) {
  const data = JSON.stringify(message);
  for (const [socket, player] of clients) {
    if (socket !== except && player && socket.readyState === WebSocket.OPEN && socket.bufferedAmount < 65536) {
      socket.send(data);
    }
  }
}

const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (request.method === 'GET' && pathname === '/health') {
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end('ok');
    return;
  }
  if (request.method !== 'GET' || (pathname !== '/' && pathname !== '/a.html')) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  fs.readFile(GAME_FILE, (error, html) => {
    if (error) {
      console.error('Không đọc được a.html:', error);
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Không thể tải game.');
      return;
    }
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(html);
  });
});

const wss = new WebSocketServer({ server, maxPayload: 4096, perMessageDeflate: false });
wss.on('connection', socket => {
  if (clients.size >= MAX_PLAYERS) {
    socket.close(1013, 'Máy chủ đã đủ người chơi');
    return;
  }
  clients.set(socket, null);
  let lastUpdate = 0;

  socket.on('message', data => {
    let input;
    try {
      input = JSON.parse(data.toString());
    } catch (error) {
      socket.close(1007, 'Dữ liệu không hợp lệ');
      return;
    }
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      socket.close(1007, 'Dữ liệu không hợp lệ');
      return;
    }
    const player = clients.get(socket);
    if (!player) {
      if (input.type !== 'join') {
        socket.close(1008, 'Cần tham gia game trước');
        return;
      }
      const id = crypto.randomBytes(12).toString('hex');
      const joined = makePlayer(id, input);
      if (!joined) {
        socket.close(1008, 'Tên hoặc nhân vật không hợp lệ');
        return;
      }
      clients.set(socket, joined);
      send(socket, { type: 'welcome', id, players: Array.from(clients.values()).filter(p => p && p.id !== id) });
      broadcast({ type: 'player', player: joined }, socket);
      return;
    }
    if (input.type !== 'move') {
      socket.close(1008, 'Loại dữ liệu không hợp lệ');
      return;
    }
    const now = Date.now();
    if (now - lastUpdate < 40) return;
    lastUpdate = now;
    makePlayer(player.id, input, player);
    broadcast({ type: 'player', player }, socket);
  });

  socket.on('close', () => {
    const player = clients.get(socket);
    clients.delete(socket);
    if (player) broadcast({ type: 'leave', id: player.id });
  });
  socket.on('error', error => console.error('Kết nối WebSocket lỗi:', error.message));
});

const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    if (socket.isAlive === false) {
      socket.terminate();
      continue;
    }
    socket.isAlive = false;
    socket.ping();
  }
}, 30000);

wss.on('connection', socket => {
  socket.isAlive = true;
  socket.on('pong', () => { socket.isAlive = true; });
});

server.listen(PORT, '0.0.0.0', () => console.log(`Game online tại cổng ${PORT}`));
server.on('close', () => clearInterval(heartbeat));
