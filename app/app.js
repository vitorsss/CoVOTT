var app = {};
(function (io, Rect) {
    'use strict';
    var socket,
        currentFileAddress,
        rects,
        currentRect;

    app.requestNextFileAddress = function () {
        socket.emit('getNextFileAddress', currentFileAddress);
    };

    app.requestPreviousFileAddress = function () {
        socket.emit('getPreviousFileAddress', currentFileAddress);
    };

    app.initConnection = function () {
        socket = io.connect('/');
        socket.on('updatedFileAddress', function (updatedFileAddress, updatedFileRects) {
            window.console.log(updatedFileAddress, JSON.stringify(updatedFileRects));
            if (updatedFileAddress) {
                currentFileAddress = updatedFileAddress;
                rects = {};
                for (var rect in updatedFileRects) {
                    if (updatedFileRects.hasOwnProperty(rect)) {
                        rect = updatedFileRects[rect];
                        rects[rect.creationTimestamp] = Rect.fromObject(rect);
                    }
                }
                var background = new Image();
                background.src = '/yolo/' + updatedFileAddress;
                background.onload = function () {
                    app.background = background;
                    app.canvas.width = app.background.width;
                    app.canvas.height = app.background.height;
                    app.draw();
                };
            }
        });
        socket.on('newFile', function (newFileAddress) {
            window.console.log(newFileAddress);
        });
        socket.on('imageRectAdded', function (fileAddress, rect) {
            if (fileAddress === currentFileAddress) {
                window.console.log('imageRectAdded', new Date().getTime(), JSON.stringify(rect));
                rects[rect.creationTimestamp] = Rect.fromObject(rect);
                app.draw();
            }
        });
        socket.emit('getNextFileAddress');
    };

    app.initCanvas = function () {
        app.canvas = document.getElementById("imageCanvas");
        app.canvas.width = window.innerWidth - 18;
        app.canvas.height = 630;
        app.canvasContext = app.canvas.getContext("2d");

        app.canvas.onmousedown = function (e) {
            app.isMouseDown = true;
            var rect = app.canvas.getBoundingClientRect();
            app.initialX = e.clientX - rect.left;
            app.initialY = e.clientY - rect.top;
        };
        app.canvas.onmousemove = function (e) {
            if (app.isMouseDown) {
                var rect = app.canvas.getBoundingClientRect();
                app.x = e.clientX - rect.left;
                app.y = e.clientY - rect.top;
                app.draw();
            }
        };
        app.canvas.onmouseup = function () {
            app.isMouseDown = false;
            var left = Math.min(app.initialX, app.x),
                top = Math.min(app.initialY, app.y),
                right = Math.max(app.initialX, app.x),
                bottom = Math.max(app.initialY, app.y);
            currentRect = new Rect(left, top, right, bottom);
            rects[currentRect.creationTimestamp] = currentRect;
            window.console.log('addImageRect', new Date().getTime());
            socket.emit('addImageRect', currentFileAddress, currentRect);
        };

        app.initConnection();
    };

    app.draw = function () {
        if (app.background && app.background.complete) {
            app.canvasContext.drawImage(app.background, 0, 0);
        }

        if (rects) {
            for (var rect in rects) {
                if (rects.hasOwnProperty(rect)) {
                    rect = rects[rect];
                    app.canvasContext.beginPath();
                    app.canvasContext.rect(rect.left, rect.top, rect.width(), rect.height());
                    app.canvasContext.stroke();
                }
            }
        }
        if (app.isMouseDown) {
            app.canvasContext.beginPath();
            app.canvasContext.rect(app.initialX, app.initialY, app.x - app.initialX, app.y - app.initialY);
            app.canvasContext.stroke();
        }
    };
}(window.io, window.Rect));
