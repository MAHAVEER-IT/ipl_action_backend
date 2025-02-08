const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8000 });
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Store room and player information with WebSocket connections
const clients = new Map(); // Map to store client WebSocket connections
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

      if (data.type === 'join_room') {
        // Store client connection with player and room info
        clients.set(ws, {
          player: data.player,
          room: data.room
        });
      }

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

  ws.on('close', async function close() {
    console.log('Client disconnected. Total clients:', wss.clients.size);
    
    // Get disconnected player's info
    const clientInfo = clients.get(ws);
    if (clientInfo) {
      const { player, room } = clientInfo;
      
      try {
        // Update player's online status in Firestore
        const roomRef = db.collection('rooms').doc(room);
        const roomDoc = await roomRef.get();
        
        if (roomDoc.exists) {
          const players = roomDoc.data().players;
          const updatedPlayers = players.map(p => {
            if (p.name === player) {
              return { ...p, isOnline: false };
            }
            return p;
          });

          await roomRef.update({ players: updatedPlayers });
          console.log(`Updated ${player}'s online status to false in room ${room}`);
        }

        // Remove client from our map
        clients.delete(ws);
        
        // Notify other clients about player disconnection
        wss.clients.forEach(function each(client) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'player_left',
              room: room,
              player: player
            }));
          }
        });
      } catch (error) {
        console.error('Error updating player online status:', error);
      }
    }

    // Clear interval
    if (ws.intervalId) {
      clearInterval(ws.intervalId);
    }
  });

  // Store interval ID with the WebSocket connection
  ws.intervalId = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'status_update',
        connectedClients: wss.clients.size
      }));
    }
  }, 30000);
});

// Error handling
wss.on('error', function error(error) {
  console.error('WebSocket server error:', error);
});

const port = process.env.PORT || 8000;
console.log(`WebSocket server started on port ${port}`);