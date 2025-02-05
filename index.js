const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8000 });

wss.on('connection', function connection(ws) {
  console.log('New client connected!, total clients connected: ', wss.clients.size);

  ws.send('Welcome to the chat room!');

  ws.on('message', (message) => {
    console.log('Received message: ', message);
    // Broadcast the message to all clients
    wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send('Server response: You sent: ' + message);
      }
    });
  });

  setInterval(() => {
    ws.send('Total there are ' + wss.clients.size + ' clients connected');
  }, 5000);

  ws.on('close', () => {
    console.log('Client disconnected, total clients connected: ', wss.clients.size);
  });
});

console.log('Server started on ws://localhost:8000');