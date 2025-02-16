require('dotenv').config();
const WebSocket = require('ws');
const port = process.env.PORT || 8000;
const pingInterval = process.env.WS_PING_INTERVAL || 30000;

const wss = new WebSocket.Server({ port });

// Store room and player information with WebSocket connections
const clients = new Map(); // Map to store client WebSocket connections
const rooms = new Map();

wss.on('connection', function connection(ws) {
  console.log('New client connected! Total clients:', wss.clients.size);

  let playerInfo = null;
  let roomInfo = null;

  ws.send(JSON.stringify({
    type: 'connection_established',
    message: 'Connected to IPL Action Game Server'
  }));

  ws.on('message', function incoming(message) {
    try {
      const data = JSON.parse(message);
      console.log('Received message:', data);

      if (data.type === 'join_room') {
        // Store player and room info for this connection
        playerInfo = data.player;
        roomInfo = data.room;
        
        // Store client connection with player and room info
        clients.set(ws, {
          player: data.player,
          room: data.room
        });

        // Broadcast player online status
        wss.clients.forEach(function each(client) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'player_status',
              room: data.room,
              player: data.player,
              isOnline: true
            }));
          }
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

        case 'player_offline':
          // Broadcast player offline status to all clients
          wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'player_status',
                room: data.room,
                player: data.player,
                isOnline: false
              }));
            }
          });
          break;

        case 'player_online':
          // Broadcast player online status to all clients
          wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'player_status',
                room: data.room,
                player: data.player,
                isOnline: true
              }));
            }
          });
          break;

        case 'new_bid':
          // Broadcast bid to all clients in the room with team info
          wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'new_bid',
                room: data.room,
                bidder: data.bidder,
                bidderTeam: data.bidderTeam, // Add team info
                amount: data.amount,
                player: data.player,
                timestamp: Date.now()
              }));
            }
          });
          break;

        case 'bid_status':
          // Broadcast bid status (going once/twice/sold)
          wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'bid_status',
                room: data.room,
                status: data.status,
                currentBidder: data.currentBidder,
                bidderTeam: data.bidderTeam
              }));
            }
          });
          break;

        case 'game_countdown_start':
          // Broadcast countdown start to all clients in the room
          wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'game_countdown_start',
                room: data.room
              }));
            }
          });
          break;

        case 'game_countdown':
          // Broadcast current countdown number to all clients in the room
          wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'game_countdown',
                room: data.room,
                count: data.count
              }));
            }
          });
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
    
    // Get disconnected player's info
    const clientInfo = clients.get(ws);
    if (clientInfo) {
      const { player, room } = clientInfo;
      
      // Broadcast player offline status
      wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'player_status',
            room: room,
            player: player,
            isOnline: false
          }));
        }
      });

      // Remove client from our map
      clients.delete(ws);
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
  }, parseInt(pingInterval));
});

// Error handling
wss.on('error', function error(error) {
  console.error('WebSocket server error:', error);
});

console.log(`WebSocket server started on port ${port}`);