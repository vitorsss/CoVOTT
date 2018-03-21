var inicio = new Date().getTime(),
    express = require('express'),
    DEFAULT_PORT = 8080,
    path = require('path'),
    app = express(),
    server = require('http').Server(app),
    io = require('socket.io')(server),
    Log = require('log'),
    fs = require('fs'),
    log = new Log('debug', fs.createWriteStream('my.log')),
    users = 0;

app.use('/', express['static'](path.join(__dirname, 'app')));

io.on('connection', function (socket) {
	users += 1;
    log.info('Connected users: %d', users);
    socket.on('disconnect', function () {
        users -= 1;
    });
});

server.listen(DEFAULT_PORT);
log.info('Running on http://localhost:' + DEFAULT_PORT + " - " + (new Date().getTime() - inicio));
