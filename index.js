const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8000 });

// Store room and player information
const rooms = new Map();

wss.on('connection', function connection(ws) {
  console.log('New client connected! Total clients:', wss.clients.size);

  ws.send(JSON.stringify({
    type: 'connection_established',
    message: 'Connected to IPL Action Game Server'
  }));

  ws.on('message', function incoming(message) {
    try {
      const data = JSON.parse(message);
      console.log('Received message:', data);

      switch (data.type) {
        case 'team_selected':
          // Handle team selection
          if (!rooms.has(data.room)) {
            rooms.set(data.room, new Set());
          }
          
          // Broadcast team selection to all clients in the room
          wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'team_update',
                room: data.room,
                player: data.player,
                team: data.team
              }));
            }
          });
          break;

        case 'join_room':
          // Handle player joining room
          if (!rooms.has(data.room)) {
            rooms.set(data.room, new Set());
          }
          rooms.get(data.room).add(data.player);
          
          // Broadcast new player joined
          wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'player_joined',
                room: data.room,
                player: data.player
              }));
            }
          });
          break;

        case 'start_game':
          // Handle game start
          if (rooms.has(data.room)) {
            wss.clients.forEach(function each(client) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'game_started',
                  room: data.room
                }));
              }
            });
          }
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', function close() {
    console.log('Client disconnected. Total clients:', wss.clients.size);
    // Clean up rooms when players disconnect
    rooms.forEach((players, room) => {
      players.forEach(player => {
        // Broadcast player left
        wss.clients.forEach(function each(client) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'player_left',
              room: room,
              player: player
            }));
          }
        });
      });
    });
  });

  // Send periodic updates about connected clients
  const intervalId = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'status_update',
        connectedClients: wss.clients.size
      }));
    }
  }, 30000); // Every 30 seconds

  // Clear interval when connection closes
  ws.on('close', () => {
    clearInterval(intervalId);
  });
});

// Error handling
wss.on('error', function error(error) {
  console.error('WebSocket server error:', error);
});

const port = process.env.PORT || 8000;
console.log(`WebSocket server started on port ${port}`);