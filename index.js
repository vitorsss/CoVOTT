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
        tags = {},
        mapArquivos = {},
        objectNamesWriteStreams = {},
        lastObject = {},
        fistFile = {};


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

    function saveMappingFile(arquivo, projectName) {
        log.debug('Saving mapping file', arquivo);
        if (arquivo.updateMappingPromisse) {
            arquivo.updateMappingPromisse.then(function () {
                saveMappingFile(arquivo, projectName);
            }, function () {
                saveMappingFile(arquivo, projectName);
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
                                if (tags[projectName].indexOf(tag) > -1) {
                                    mappingWriteStream.write((newLine ? '\n' : '') + tags[projectName].indexOf(tag) + ' ' + (xc/arquivo.dimensions.width) + ' ' + (yc/arquivo.dimensions.height) + ' ' + (w/arquivo.dimensions.width) + ' ' + (h/arquivo.dimensions.height));
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
                saveMappingFile(arquivo, projectName);
            });
        }
    }

    function verificaObjectData(resolve, reject, projectName, pathObjData, pathObjNames, pathObjTest, pathObjTrain, pathObjFolder) {
        var promissesVerifyProjectData = [];
        promissesVerifyProjectData.push(verifyIfFileExistCreateIfNot(pathObjData, function (resolve2, reject2) {
            var objDataWriteStream = fs.createWriteStream(pathObjData);
            objDataWriteStream.on('error', reject2);
            objDataWriteStream.on('finish', resolve2);
            objDataWriteStream.end();
        }));

        promissesVerifyProjectData.push(verifyIfFileExistCreateIfNot(pathObjNames, function (resolve2) {
            resolve2();
        }, function (resolve2, reject2) {
            var objNameReadLine = readline.createInterface({
                    input: fs.createReadStream(pathObjNames)
                });
            objNameReadLine.on('line', function (line) {
                log.info('Tag ', line, ' was added to project', projectName);
                tags[projectName].push(line);
            });
            objNameReadLine.on('close', function () {
                resolve2();
            });
            objNameReadLine.on('error', function (err) {
                reject2(err);
            });
        }));

        promissesVerifyProjectData.push(verifyIfFileExistCreateIfNot(pathObjTest, function (resolve2, reject2) {
            var objTestWriteStream = fs.createWriteStream(pathObjTest);
            objTestWriteStream.on('error', reject2);
            objTestWriteStream.on('finish', resolve2);
            objTestWriteStream.end();
        }));

        promissesVerifyProjectData.push(verifyIfFileExistCreateIfNot(pathObjTrain, function (resolve2, reject2) {
            var objTrainWriteStream = fs.createWriteStream(pathObjTrain);
            objTrainWriteStream.on('error', reject2);
            objTrainWriteStream.on('finish', resolve2);
            objTrainWriteStream.end();
        }));

        promissesVerifyProjectData.push(verifyIfFileExistCreateIfNot(pathObjFolder, function (resolve2, reject2) {
            fs.mkdir(pathObjFolder, function (err) {
                if (err) {
                    reject2(err);
                } else {
                    resolve2();
                }
            });
        }));
        Promise.all(promissesVerifyProjectData).then(function () {
            resolve();
        }, function (err) {
            reject(err);
        });
    }

    function verifyProjectFiles(projectName, prop, promissesVerifyProject) {
        var pathProjectYoloFolder = prop.path.project[projectName],
            pathYoloCfg = path.join(pathProjectYoloFolder, 'yolo-voc.cfg'),
            pathDataFolder = path.join(pathProjectYoloFolder, 'data'),
            pathObjData = path.join(pathDataFolder, 'obj.data'),
            pathObjNames = path.join(pathDataFolder, 'obj.names'),
            pathObjTest = path.join(pathDataFolder, 'test.txt'),
            pathObjTrain = path.join(pathDataFolder, 'train.txt'),
            pathObjFolder = path.join(pathDataFolder, 'obj');

        promissesVerifyProject.push(verifyIfFileExistCreateIfNot(pathYoloCfg, function (resolve, reject) {
            var yoloCfgWriteStream = fs.createWriteStream(pathYoloCfg);
            yoloCfgWriteStream.on('error', reject);
            yoloCfgWriteStream.on('finish', resolve);
            yoloCfgWriteStream.end();
        }));

        promissesVerifyProject.push(verifyIfFileExistCreateIfNot(pathDataFolder, function (resolve, reject) {
            fs.mkdir(pathDataFolder, function (err) {
                if (err) {
                    reject(err);
                } else {
                    verificaObjectData(resolve, reject, projectName, pathObjData, pathObjNames, pathObjTest, pathObjTrain, pathObjFolder);
                }
            });
        }, function (resolve, reject) {
            verificaObjectData(resolve, reject, projectName, pathObjData, pathObjNames, pathObjTest, pathObjTrain, pathObjFolder);
        }));
    }

    function startWatchProject(projectName, prop) {
        return new Promise(function (resolveWatch) {
            log.debug('Init watch for', path.join(prop.path.project[projectName], 'data', 'obj'));
            chokidar.watch(path.join(prop.path.project[projectName], 'data', 'obj'), {ignored: "**/*.txt", cwd: prop.path.project[projectName], persistent: true}).on('add', function (filename) {
                log.info(filename, ' was added');
                if (lastObject[projectName]) {
                    lastObject[projectName].nextFile = filename;
                } else {
                    fistFile[projectName] = filename;
                }
                var tempCurrentObject,
                    dimensions = imageSize(path.join(prop.path.project[projectName], filename)),
                    mappingFileName = path.join(prop.path.project[projectName], filename.substring(0, filename.lastIndexOf('.')) + ".txt");
                lastObject[projectName] = {currentFile: filename, rects: [], lastFile: (lastObject[projectName] ? lastObject[projectName].currentFile : undefined), updateMappingPromisse: undefined, mappingFileName: mappingFileName, dimensions: dimensions};
                mapArquivos[projectName][filename] = lastObject[projectName];
                tempCurrentObject = lastObject[projectName];
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
                            tag = tags[projectName][parseInt(lineSplit[0], 10)],
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
                var tempFileObject = mapArquivos[projectName][filename],
                    tempLastObject = mapArquivos[projectName][tempFileObject.lastFile],
                    tempNextObject;
                if (filename === fistFile[projectName]) {
                    fistFile[projectName] = tempFileObject.nextFile;
                } else if (tempLastObject) {
                    tempLastObject.nextFile = tempFileObject.nextFile;
                }
                if (lastObject[projectName].currentFile === tempFileObject.currentFile) {
                    lastObject[projectName] = mapArquivos[projectName][tempFileObject.lastFile];
                } else {
                    tempNextObject = mapArquivos[projectName][tempFileObject.nextFile];
                    if (tempNextObject) {
                        tempNextObject.lastFile = tempFileObject.lastFile;
                    }
                }
                delete mapArquivos[projectName][filename];
                io.sockets.emit('deletedFile', filename);
            }).on('ready', function () {
                log.debug('Watch is ready for', path.join(prop.path.project[projectName], 'data', 'obj'));
                resolveWatch();
            });
        });
    }

    propertiesLoader.parse('config.properties', {path: true, namespaces: true}, function (err, prop) {

        log.debug(prop);
        var promissesVerifyProject = [];
        for (var projectName in prop.path.project) {
            app.use('/' + projectName + '/', express['static'](prop.path.project[projectName]));
            tags[projectName] = [];
            mapArquivos[projectName] = {};
            verifyProjectFiles(projectName, prop, promissesVerifyProject);
        }

        Promise.all(promissesVerifyProject).then(function () {
            app.use('/', express['static'](path.join('app')));

            var promissesWatchProject = [];
            for (var projectName in prop.path.project) {
                objectNamesWriteStreams[projectName] = fs.createWriteStream(path.join(prop.path.project[projectName], 'data', 'obj.names'), {flags: 'a'});
                promissesWatchProject.push(startWatchProject(projectName, prop));
            }

            Promise.all(promissesWatchProject).then(function () {
                log.info('Initial scan complete!');
                io.on('connection', function (socket) {
                    users += 1;
                    log.info('Connected users: %d', users);

                    socket.on('listProjects', function () {
                        socket.emit('projects', Object.keys(prop.path.project));
                    });

                    socket.on('getNextFileAddress', function (current) {
                        log.debug(socket.room, 'getNextFileAddress', current, JSON.stringify(mapArquivos[socket.room][current]));
                        if (current && mapArquivos[socket.room].hasOwnProperty(current)) {
                            if (mapArquivos[socket.room][current].nextFile) {
                                socket.emit('updatedFileAndRects', mapArquivos[socket.room][current].nextFile, mapArquivos[socket.room][mapArquivos[socket.room][current].nextFile].rects);
                            }
                        } else {
                            socket.emit('updatedFileAndRects', fistFile[socket.room], mapArquivos[socket.room][fistFile[socket.room]].rects);
                        }
                    });

                    socket.on('getNextUntaggedFileAddress', function (current) {
                        log.debug(socket.room, 'getNextUntaggedFileAddress', current, JSON.stringify(mapArquivos[socket.room][current]));
                        if (current && mapArquivos[socket.room].hasOwnProperty(current)) {
                            while (mapArquivos[socket.room][current].nextFile && mapArquivos[socket.room][mapArquivos[socket.room][current].nextFile].rects.length) {
                                current = mapArquivos[socket.room][current].nextFile;
                            }
                            if (mapArquivos[socket.room][current].nextFile) {
                                socket.emit('updatedFileAndRects', mapArquivos[socket.room][current].nextFile, mapArquivos[socket.room][mapArquivos[socket.room][current].nextFile].rects);
                            } else {
                                socket.emit('updatedFileAndRects', current, mapArquivos[socket.room][current].rects);
                            }
                        } else {
                            socket.emit('updatedFileAndRects', fistFile[socket.room], mapArquivos[socket.room][fistFile[socket.room]].rects);
                        }
                    });

                    socket.on('getPreviousFileAddress', function (current) {
                        log.debug(socket.room, 'getPreviousFileAddress', current, JSON.stringify(mapArquivos[socket.room][current]));
                        if (current && mapArquivos[socket.room].hasOwnProperty(current)) {
                            if (mapArquivos[socket.room][current].lastFile) {
                                socket.emit('updatedFileAndRects', mapArquivos[socket.room][current].lastFile, mapArquivos[socket.room][mapArquivos[socket.room][current].lastFile].rects);
                            }
                        } else {
                            socket.emit('updatedFileAndRects', fistFile[socket.room], mapArquivos[socket.room][fistFile[socket.room]].rects);
                        }
                    });

                    socket.on('getPreviousUntaggedFileAddress', function (current) {
                        log.debug(socket.room, 'getPreviousFileAddress', current, JSON.stringify(mapArquivos[socket.room][current]));
                        if (current && mapArquivos[socket.room].hasOwnProperty(current)) {
                            while (mapArquivos[socket.room][current].lastFile && mapArquivos[socket.room][mapArquivos[socket.room][current].lastFile].rects.length) {
                                current = mapArquivos[socket.room][current].lastFile;
                            }
                            if (mapArquivos[socket.room][current].lastFile) {
                                socket.emit('updatedFileAndRects', mapArquivos[socket.room][current].lastFile, mapArquivos[socket.room][mapArquivos[socket.room][current].lastFile].rects);
                            } else {
                                socket.emit('updatedFileAndRects', current, mapArquivos[socket.room][current].rects);
                            }
                        } else {
                            socket.emit('updatedFileAndRects', fistFile[socket.room], mapArquivos[socket.room][fistFile[socket.room]].rects);
                        }
                    });

                    socket.on('addTag', function (tag) {
                        log.info(socket.room, 'Add tag: ', tag);
                        tags[socket.room].push(tag);
                        objectNamesWriteStreams[projectName].write((tags[socket.room].length > 1 ? '\n' : '') + tag);
                        socket.emit('updateTags', tags[socket.room]);
                    });

                    socket.on('getTags', function () {
                        socket.emit('updateTags', tags[socket.room]);
                    });

                    socket.on('addImageRect', function (fileAddress, rect) {
                        mapArquivos[socket.room][fileAddress].rects.push(rect);
                        log.debug(socket.room, 'Rect added', rect);
                        saveMappingFile(mapArquivos[socket.room][fileAddress], socket.room);
                        socket.broadcast.to(socket.room).emit('imageRectAddedOrChanged', fileAddress, rect);
                    });

                    socket.on('deleteImageRect', function (fileAddress, rect) {
                        var indice = mapArquivos[socket.room][fileAddress].rects.findIndex(function (obj) {
                            return obj.creationTimestamp === rect.creationTimestamp;
                        });
                        mapArquivos[socket.room][fileAddress].rects.splice(indice, 1);
                        log.debug(socket.room, 'Rect deleted', rect);
                        saveMappingFile(mapArquivos[socket.room][fileAddress], socket.room);
                        socket.broadcast.to(socket.room).emit('imageRectDeleted', fileAddress, rect);
                    });

                    socket.on('updateRect', function (fileAddress, rect) {
                        var indice = mapArquivos[socket.room][fileAddress].rects.findIndex(function (obj) {
                            return obj.creationTimestamp === rect.creationTimestamp;
                        });
                        mapArquivos[socket.room][fileAddress].rects[indice] = rect;
                        log.debug(socket.room, 'Rect updated', rect);
                        saveMappingFile(mapArquivos[socket.room][fileAddress], socket.room);
                        socket.broadcast.to(socket.room).emit('imageRectAddedOrChanged', fileAddress, rect);
                    });

                    socket.on('room', function(room){
                        if(socket.room)
                            socket.leave(socket.room);

                        socket.room = room;
                        socket.join(room);
                    });

                    socket.on('disconnect', function () {
                        users -= 1;
                    });
                });

                server.listen(DEFAULT_PORT);
                log.info('Running on http://localhost:' + DEFAULT_PORT + " - " + (new Date().getTime() - initialTimestamp));
            }, function () {

            })
        }, function (err) {
            log.error('Erro ao verificar arquivos YOLO:', err);
        });

    });
}(require));
