const http = require('http');
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'bali-trip-tracker.html');
http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type':'text/html','Cache-Control':'no-store'});
  fs.createReadStream(file).pipe(res);
}).listen(5180, () => console.log('Bali tracker on http://localhost:5180'));
