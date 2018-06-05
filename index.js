(function (require) {
    'use strict';
    var initialTimestamp = new Date().getTime(),
        express = require('express'),
        DEFAULT_PORT = 8080,
        path = require('path'),
        app = express(),
        server = require('http').Server(app),
        io = require('socket.io')(server, {wsEngine: 'ws'}),
        chokidar = require('chokidar'),
        Log = require('log'),
        fs = require('fs'),
        Promise = require('promise'),
        readline = require('readline'),
        imageSize = require('image-size'),
        log = new Log('debug', fs.createWriteStream('my.log')),
        users = 0,
        propertiesLoader = require("properties"),
        tags = [];


    function verifyIfFileExistCreateIfNot(filePath, createFunction, existFunction) {
        return new Promise(function (resolve, reject) {
            fs.stat(filePath, function (err) {
                if (err) {
                    if (err.code === 'ENOENT') {
                        createFunction(resolve, reject);
                    } else {
                        log.error(err);
                        reject(filePath, err);
                    }
                } else {
                    if (existFunction) {
                        existFunction(resolve, reject);
                    } else {
                        resolve();
                    }
                }
            });
        });
    }

    function saveMappingFile(arquivo) {
        log.debug('Saving mapping file', arquivo);
        if (arquivo.updateMappingPromisse) {
            arquivo.updateMappingPromisse.then(function () {
                saveMappingFile(arquivo);
            }, function () {
                saveMappingFile(arquivo);
            });
        } else {
            arquivo.updateMappingPromisse = new Promise(function (resolve, reject) {
                var initialSaveTimestamp = new Date().getTime(),
                    mappingWriteStream = fs.createWriteStream(arquivo.mappingFileName),
                    rect,
                    tag,
                    newLine = false;
                mappingWriteStream.on('error', function (err) {
                    log.error(err);
                    reject();
                });
                mappingWriteStream.on('finish', function () {
                    resolve();
                    log.debug('saveMappingFile took', new Date().getTime() - initialSaveTimestamp, 'ms');
                });
                for (rect in arquivo.rects) {
                    if (arquivo.rects.hasOwnProperty(rect)) {
                        rect = arquivo.rects[rect];
                        var w = rect.right - rect.left,
                            h = rect.bottom - rect.top,
                            xc = rect.left + w/2,
                            yc = rect.top + h/2;
                        for (tag in rect.tags) {
                            if (rect.tags.hasOwnProperty(tag)) {
                                tag = rect.tags[tag];
                                if (tags.indexOf(tag) > -1) {
                                    mappingWriteStream.write((newLine ? '\n' : '') + tags.indexOf(tag) + ' ' + (xc/arquivo.dimensions.width) + ' ' + (yc/arquivo.dimensions.height) + ' ' + (w/arquivo.dimensions.width) + ' ' + (h/arquivo.dimensions.height));
                                    newLine = true;
                                }
                            }
                        }
                    }
                }
                mappingWriteStream.end();
            }).then(function () {
                delete arquivo.updateMappingPromisse;
            }, function () {
                delete arquivo.updateMappingPromisse;
                saveMappingFile(arquivo);
            });
        }
    }

    propertiesLoader.parse('config.properties', {path: true, namespaces: true}, function (err, prop) {

        log.debug(prop);
        var pathProjectYoloFolder = prop.path.project.yolo,
            pathYoloCfg = path.join(pathProjectYoloFolder, 'yolo-voc.cfg'),
            pathDataFolder = path.join(pathProjectYoloFolder, 'data'),
            pathObjData = path.join(pathDataFolder, 'obj.data'),
            pathObjNames = path.join(pathDataFolder, 'obj.names'),
            pathObjTest = path.join(pathDataFolder, 'test.txt'),
            pathObjTrain = path.join(pathDataFolder, 'train.txt'),
            pathObjFolder = path.join(pathDataFolder, 'obj'),
            promissesVerifyYolo = [],
            mapArquivos = {},
            lastObject,
            fistFile,
            objNamesWriteStream;

        promissesVerifyYolo.push(verifyIfFileExistCreateIfNot(pathYoloCfg, function (resolve, reject) {
            var yoloCfgWriteStream = fs.createWriteStream(pathYoloCfg);
            yoloCfgWriteStream.on('error', reject);
            yoloCfgWriteStream.on('finish', resolve);
            yoloCfgWriteStream.end();
        }));

        function verificaObjectData(resolve, reject) {
            var promissesVerifyYoloData = [];
            promissesVerifyYoloData.push(verifyIfFileExistCreateIfNot(pathObjData, function (resolve2, reject2) {
                var objDataWriteStream = fs.createWriteStream(pathObjData);
                objDataWriteStream.on('error', reject2);
                objDataWriteStream.on('finish', resolve2);
                objDataWriteStream.end();
            }));

            promissesVerifyYoloData.push(verifyIfFileExistCreateIfNot(pathObjNames, function (resolve2) {
                resolve2();
            }, function (resolve2, reject2) {
                var objNameReadLine = readline.createInterface({
                        input: fs.createReadStream(pathObjNames)
                    });
                objNameReadLine.on('line', function (line) {
                    log.info('Tag ', line, ' was added');
                    tags.push(line);
                });
                objNameReadLine.on('close', function () {
                    resolve2();
                });
                objNameReadLine.on('error', function (err) {
                    reject2(err);
                });
            }));

            promissesVerifyYoloData.push(verifyIfFileExistCreateIfNot(pathObjTest, function (resolve2, reject2) {
                var objTestWriteStream = fs.createWriteStream(pathObjTest);
                objTestWriteStream.on('error', reject2);
                objTestWriteStream.on('finish', resolve2);
                objTestWriteStream.end();
            }));

            promissesVerifyYoloData.push(verifyIfFileExistCreateIfNot(pathObjTrain, function (resolve2, reject2) {
                var objTrainWriteStream = fs.createWriteStream(pathObjTrain);
                objTrainWriteStream.on('error', reject2);
                objTrainWriteStream.on('finish', resolve2);
                objTrainWriteStream.end();
            }));

            promissesVerifyYoloData.push(verifyIfFileExistCreateIfNot(pathObjFolder, function (resolve2, reject2) {
                fs.mkdir(pathObjFolder, function (err) {
                    if (err) {
                        reject2(err);
                    } else {
                        resolve2();
                    }
                });
            }));
            Promise.all(promissesVerifyYoloData).then(function () {
                resolve();
            }, function (err) {
                reject(err);
            });
        }

        promissesVerifyYolo.push(verifyIfFileExistCreateIfNot(pathDataFolder, function (resolve, reject) {
            fs.mkdir(pathDataFolder, function (err) {
                if (err) {
                    reject(err);
                } else {
                    verificaObjectData(resolve, reject);
                }
            });
        }, verificaObjectData));

        Promise.all(promissesVerifyYolo).then(function () {
            app.use('/', express['static'](path.join('app')));
            app.use('/yolo/', express['static'](pathProjectYoloFolder));

            objNamesWriteStream = fs.createWriteStream(pathObjNames, {flags: 'a'});

            chokidar.watch(pathObjFolder, {ignored: "**/*.txt", cwd: pathProjectYoloFolder, persistent: true}).on('add', function (filename) {
                log.info(filename, ' was added');
                if (lastObject) {
                    lastObject.nextFile = filename;
                } else {
                    fistFile = filename;
                }
                var tempCurrentObject,
                    dimensions = imageSize(path.join(pathProjectYoloFolder, filename)),
                    mappingFileName = path.join(pathProjectYoloFolder, filename.substring(0, filename.lastIndexOf('.')) + ".txt");
                lastObject = {currentFile: filename, rects: [], lastFile: (lastObject ? lastObject.currentFile : undefined), updateMappingPromisse: undefined, mappingFileName: mappingFileName, dimensions: dimensions};
                mapArquivos[filename] = lastObject;
                tempCurrentObject = lastObject;
                verifyIfFileExistCreateIfNot(mappingFileName, function (resolve) {
                    log.debug('No mapping found for', filename, 'file not found', mappingFileName);
                    resolve([]);
                }, function (resolve) {
                    var mappingFileReadLine = readline.createInterface({
                            input: fs.createReadStream(mappingFileName)
                        }),
                        rects = [];
                    mappingFileReadLine.on('line', function (line) {
                        log.debug('reading rect', line, 'from', filename, 'with dimentions', dimensions);
                        var lineSplit = line.split(' '),
                            tag = tags[parseInt(lineSplit[0], 10)],
                            xc = dimensions.width * parseFloat(lineSplit[1]),
                            yc = dimensions.height * parseFloat(lineSplit[2]),
                            w = dimensions.width * parseFloat(lineSplit[3]),
                            h = dimensions.height * parseFloat(lineSplit[4]),
                            x = xc - w/2,
                            y = yc - h/2,
                            rect = {
                                left: Math.round(x),
                                top: Math.round(y),
                                right: Math.round(x + w),
                                bottom: Math.round(y + h),
                                creationTimestamp: rects.length,
                                tags: [tag]
                            };
                        log.debug('rect readed', rect);
                        for (var oldRect in rects) {
                            if (rects.hasOwnProperty(oldRect)) {
                                oldRect = rects[oldRect];
                                if (oldRect.left === rect.left && oldRect.top === rect.top && oldRect.right === rect.right && oldRect.bottom === rect.bottom) {
                                    oldRect.tags.push(tag);
                                    rect = undefined;
                                    break;
                                }
                            }
                        }
                        if (rect) {
                            rects.push(rect);
                        }
                    });
                    mappingFileReadLine.on('close', function () {
                        resolve(rects);
                    });
                    mappingFileReadLine.on('error', function (err) {
                        log.error('Error reading file yolo mapping', filename, err);
                        resolve([], err);
                    });
                }).then(function (rects) {
                    tempCurrentObject.rects = rects;
                    io.sockets.emit('newFile', filename);
                });
            }).on('unlink', function (filename) {
                log.info(filename, ' was unlinked');
                log.debug('map before', JSON.stringify(mapArquivos));
                var tempFileObject = mapArquivos[filename],
                    tempLastObject = mapArquivos[tempFileObject.lastFile],
                    tempNextObject;
                if (filename === fistFile) {
                    fistFile = tempFileObject.nextFile;
                } else if (tempLastObject) {
                    tempLastObject.nextFile = tempFileObject.nextFile;
                }
                if (lastObject.currentFile === tempFileObject.currentFile) {
                    lastObject = mapArquivos[tempFileObject.lastFile];
                } else {
                    tempNextObject = mapArquivos[tempFileObject.nextFile];
                    if (tempNextObject) {
                        tempNextObject.lastFile = tempFileObject.lastFile;
                    }
                }
                delete mapArquivos[filename];
                log.debug('map after', JSON.stringify(mapArquivos));
                io.sockets.emit('deletedFile', filename);
            }).on('ready', function () {
                log.info('Initial scan complete!');
                io.on('connection', function (socket) {
                    users += 1;
                    log.info('Connected users: %d', users);
                    socket.on('getNextFileAddress', function (current) {
                        log.debug('getNextFileAddress', current, JSON.stringify(mapArquivos[current]));
                        if (current && mapArquivos.hasOwnProperty(current)) {
                            if (mapArquivos[current].nextFile) {
                                socket.emit('updatedFileAndRects', mapArquivos[current].nextFile, mapArquivos[mapArquivos[current].nextFile].rects);
                            }
                        } else {
                            socket.emit('updatedFileAndRects', fistFile, mapArquivos[fistFile].rects);
                        }
                    });

                    socket.on('getNextUntaggedFileAddress', function (current) {
                        log.debug('getNextUntaggedFileAddress', current, JSON.stringify(mapArquivos[current]));
                        if (current && mapArquivos.hasOwnProperty(current)) {
                            while (mapArquivos[current].nextFile && mapArquivos[mapArquivos[current].nextFile].rects.length) {
                                current = mapArquivos[current].nextFile;
                            }
                            if (mapArquivos[current].nextFile) {
                                socket.emit('updatedFileAndRects', mapArquivos[current].nextFile, mapArquivos[mapArquivos[current].nextFile].rects);
                            } else {
                                socket.emit('updatedFileAndRects', current, mapArquivos[current].rects);
                            }
                        } else {
                            socket.emit('updatedFileAndRects', fistFile, mapArquivos[fistFile].rects);
                        }
                    });

                    socket.on('getPreviousFileAddress', function (current) {
                        log.debug('getPreviousFileAddress', current, JSON.stringify(mapArquivos[current]));
                        if (current && mapArquivos.hasOwnProperty(current)) {
                            if (mapArquivos[current].lastFile) {
                                socket.emit('updatedFileAndRects', mapArquivos[current].lastFile, mapArquivos[mapArquivos[current].lastFile].rects);
                            }
                        } else {
                            socket.emit('updatedFileAndRects', fistFile, mapArquivos[fistFile].rects);
                        }
                    });

                    socket.on('getPreviousUntaggedFileAddress', function (current) {
                        log.debug('getPreviousFileAddress', current, JSON.stringify(mapArquivos[current]));
                        if (current && mapArquivos.hasOwnProperty(current)) {
                            while (mapArquivos[current].lastFile && mapArquivos[mapArquivos[current].lastFile].rects.length) {
                                current = mapArquivos[current].lastFile;
                            }
                            if (mapArquivos[current].lastFile) {
                                socket.emit('updatedFileAndRects', mapArquivos[current].lastFile, mapArquivos[mapArquivos[current].lastFile].rects);
                            } else {
                                socket.emit('updatedFileAndRects', current, mapArquivos[current].rects);
                            }
                        } else {
                            socket.emit('updatedFileAndRects', fistFile, mapArquivos[fistFile].rects);
                        }
                    });

                    socket.on('addTag', function (tag) {
                        log.info('Add tag: ', tag);
                        tags.push(tag);
                        objNamesWriteStream.write((tags.length > 1 ? '\n' : '') + tag);
                        socket.emit('updateTags', tags);
                    });

                    socket.on('getTags', function () {
                        socket.emit('updateTags', tags);
                    });

                    socket.on('addImageRect', function (fileAddress, rect) {
                        mapArquivos[fileAddress].rects.push(rect);
                        log.debug('Rect added', rect);
                        saveMappingFile(mapArquivos[fileAddress]);
                        socket.broadcast.emit('imageRectAddedOrChanged', fileAddress, rect);
                    });

                    socket.on('deleteImageRect', function (fileAddress, rect) {
                        var indice = mapArquivos[fileAddress].rects.findIndex(function (obj) {
                            return obj.creationTimestamp === rect.creationTimestamp;
                        });
                        mapArquivos[fileAddress].rects.splice(indice, 1);
                        log.debug('Rect deleted', rect);
                        saveMappingFile(mapArquivos[fileAddress]);
                        socket.broadcast.emit('imageRectDeleted', fileAddress, rect);
                    });

                    socket.on('updateRect', function (fileAddress, rect) {
                        var indice = mapArquivos[fileAddress].rects.findIndex(function (obj) {
                            return obj.creationTimestamp === rect.creationTimestamp;
                        });
                        mapArquivos[fileAddress].rects[indice] = rect;
                        log.debug('Rect updated', rect);
                        saveMappingFile(mapArquivos[fileAddress]);
                        socket.broadcast.emit('imageRectAddedOrChanged', fileAddress, rect);
                    });

                    socket.on('disconnect', function () {
                        users -= 1;
                    });
                });

                server.listen(DEFAULT_PORT);
                log.info('Running on http://localhost:' + DEFAULT_PORT + " - " + (new Date().getTime() - initialTimestamp));
            });
        }, function (err) {
            log.error('Erro ao verificar arquivos YOLO:', err);
        });

    });
}(require));
