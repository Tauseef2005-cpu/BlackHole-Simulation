const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 8000;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log(`========================================================`);
    console.log(`  BLACK HOLE RELATIVISTIC SIMULATION WEB APPLICATION    `);
    console.log(`========================================================`);
    console.log(`Server running at: ${url}`);
    console.log(`Press Ctrl+C to stop.`);

    // Auto open in default browser
    let startCmd;
    if (process.platform === 'win32') {
        startCmd = 'cmd /c start ""';
    } else if (process.platform === 'darwin') {
        startCmd = 'open';
    } else {
        startCmd = 'xdg-open';
    }

    exec(`${startCmd} "${url}"`, (err) => {
        if (err) {
            console.log(`Open in browser manually: ${url}`);
        }
    });
});
