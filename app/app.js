var app = {};
(function (io, Rect) {
    'use strict';
    var socket,
        currentFileAddress,
        rects,
        currentRect,
        canvasSameRectTolerance = 7,
        scale = 1;

    app.requestNextFileAddress = function () {
        socket.emit('getNextFileAddress', currentFileAddress);
    };

    app.requestNextUntaggedFileAddress = function () {
        socket.emit('getNextUntaggedFileAddress', currentFileAddress);
    };

    app.requestPreviousFileAddress = function () {
        socket.emit('getPreviousFileAddress', currentFileAddress);
    };

    app.requestPreviousUntaggedFileAddress = function () {
        socket.emit('getPreviousUntaggedFileAddress', currentFileAddress);
    };

    app.resizeCanvas = function () {
        if (app.background) {
            scale = Math.min((window.innerWidth - 18) / app.background.width, (window.innerHeight - 195) / app.background.height);
            app.canvas.width = app.background.width * scale;
            app.canvas.height = app.background.height * scale;
            app.draw();
        }
    };

    app.initConnection = function () {
        socket = io.connect('/');
        socket.on('updatedFileAndRects', function (updatedFileAddress, updatedFileRects) {
            window.console.log(updatedFileAddress, JSON.stringify(updatedFileRects));
            if (updatedFileAddress) {
                currentFileAddress = updatedFileAddress;
                currentRect = undefined;
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
                    app.resizeCanvas();
                };
            }
        });
        socket.on('updateTags', function (newTags) {
            app.tags = newTags;
            app.reprintTags();
        });
        socket.on('newFile', function (newFileAddress) {
            window.console.log(newFileAddress);
        });
        socket.on('imageRectAddedOrChanged', function (fileAddress, rect) {
            if (fileAddress === currentFileAddress) {
                window.console.log('imageRectAddedOrChanged', new Date().getTime(), JSON.stringify(rect));
                rects[rect.creationTimestamp] = Rect.fromObject(rect);
                if (currentRect && rect.creationTimestamp === currentRect.creationTimestamp) {
                    currentRect = rects[rect.creationTimestamp];
                }
                app.draw();
            }
        });
        socket.on('imageRectDeleted', function (fileAddress, rect) {
            if (fileAddress === currentFileAddress) {
                window.console.log('imageRectDeleted', new Date().getTime(), JSON.stringify(rect));
                if (currentRect && rect.creationTimestamp === currentRect.creationTimestamp) {
                    currentRect = undefined;
                }
                delete rects[rect.creationTimestamp];
                app.draw();
            }
        });
        socket.emit('getNextFileAddress');
        socket.emit('getTags');
    };

    window.onresize = app.resizeCanvas;

    app.reprintTags = function () {
        var tagsElement = document.getElementById('tags');
        tagsElement.innerHTML = '';
        for (var tag in app.tags) {
            if (app.tags.hasOwnProperty(tag)) {
                tag = app.tags[tag];
                var tagOption = document.createElement('option');
                tagOption.innerHTML = tag;
                tagOption.value = tag;
                tagOption.selected = currentRect && currentRect.tags && currentRect.tags.indexOf(tag) > -1;
                tagsElement.appendChild(tagOption);
            }
        }
    };

    app.adicionaTag = function () {
        var inputNewTag = document.getElementById("newTag"),
            inputNewTagValue = inputNewTag.value;
        inputNewTag.value = '';
        if (inputNewTagValue) {
            for (var tag in app.tags) {
                if (app.tags.hasOwnProperty(tag) && app.tags[tag].trim() === inputNewTagValue.trim()) {
                    alert('A tag já existe!');
                    return;
                }
            }
            socket.emit('addTag', inputNewTagValue.trim());
        }
    };

    app.atualizaRectTags = function () {
        if (currentRect) {
            currentRect.tags = Array.prototype.map.call(document.getElementById('tags').selectedOptions, function (obj) {
                return obj.value;
            });
            socket.emit('updateRect', currentFileAddress, currentRect);
        }
    };

    app.deletaCurrentRect = function () {
        delete rects[currentRect.creationTimestamp];
        socket.emit('deleteImageRect', currentFileAddress, currentRect);
        currentRect = undefined;
        app.draw();
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
            app.x = app.initialX;
            app.y = app.initialY;
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
                bottom = Math.max(app.initialY, app.y),
                tempRect = new Rect(left, top, right, bottom);
            if (tempRect.height() < canvasSameRectTolerance && tempRect.width() < canvasSameRectTolerance) {
                for (var rect in rects) {
                    if (rects.hasOwnProperty(rect)) {
                        rect = rects[rect];
                        var tempRectCenterX = tempRect.centerX(),
                            tempRectCenterY = tempRect.centerY();
                        if (tempRectCenterX > (rect.left * scale) + canvasSameRectTolerance && tempRectCenterX < (rect.right * scale) - canvasSameRectTolerance) {
                            if (tempRectCenterY < (rect.top * scale) + canvasSameRectTolerance && tempRectCenterY > (rect.top * scale) - canvasSameRectTolerance) {
                                currentRect = rect;
                                break;
                            } else if (tempRectCenterY < (rect.bottom * scale) + canvasSameRectTolerance && tempRectCenterY > (rect.bottom * scale) - canvasSameRectTolerance) {
                                currentRect = rect;
                                break;
                            }
                        } else if (tempRectCenterY > (rect.top * scale) + canvasSameRectTolerance && tempRectCenterY < (rect.bottom * scale) - canvasSameRectTolerance) {
                            if (tempRectCenterX < (rect.left * scale) + canvasSameRectTolerance && tempRectCenterX > (rect.left * scale) - canvasSameRectTolerance) {
                                currentRect = rect;
                                break;
                            } else if (tempRectCenterX < (rect.right * scale) + canvasSameRectTolerance && tempRectCenterX > (rect.right * scale) - canvasSameRectTolerance) {
                                currentRect = rect;
                                break;
                            }
                        }
                    }
                }
            } else {
                currentRect = new Rect(left / scale, top / scale, right / scale, bottom / scale);
                rects[currentRect.creationTimestamp] = currentRect;
                window.console.log('addImageRect', new Date().getTime());
                socket.emit('addImageRect', currentFileAddress, currentRect);
            }
            app.draw();
        };

        app.initConnection();
    };

    app.draw = function () {
        if (app.background && app.background.complete) {
            app.canvasContext.drawImage(app.background, 0, 0, app.background.width * scale, app.background.height * scale);
        }

        if (rects) {
            for (var rect in rects) {
                if (rects.hasOwnProperty(rect)) {
                    rect = rects[rect];
                    app.canvasContext.beginPath();
                    app.canvasContext.rect(rect.left * scale, rect.top * scale, rect.width() * scale, rect.height() * scale);
                    app.canvasContext.strokeStyle = !currentRect || rect.creationTimestamp !== currentRect.creationTimestamp || app.isMouseDown ? 'black' : 'red';
                    app.canvasContext.stroke();
                }
            }
        }
        if (app.isMouseDown) {
            app.canvasContext.beginPath();
            app.canvasContext.rect(app.initialX, app.initialY, app.x - app.initialX, app.y - app.initialY);
            app.canvasContext.strokeStyle = 'red';
            app.canvasContext.stroke();
        } else {
            app.reprintTags();
        }
    };
}(window.io, window.Rect));
