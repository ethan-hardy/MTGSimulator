'use strict';
let express = require('express');
let app = express();
let server = app.listen(8000, () => {
    console.log('Server started at 8000');
});
app.use('/', express.static('./public_html'));

let io = require('socket.io')(server);
let mySQL = require('./databaseMySQL.es6');

var signedInUserSockets = {}, numConnectedUsers = 0;
var rooms = {};

io.on('connection', (socket) => {
    socket.on('signInWithInfo', function(username, password, cb) { //cb should have the form fn(deckLists, user, errMessage)
        mySQL.deckListsForUser(username, password, function(deckLists, user, errMessage) {
            if (errMessage === null) {                    //user is {userID: _ , username: _ }
                signedInUserSockets[user.username] = socket;
                numConnectedUsers++;
                console.log("User " + user.username + " connected; " + numConnectedUsers + " users now connected");
            }
            cb(deckLists, user, errMessage);
        });
    });
    socket.on('signUpWithInfo', function(username, password, cb) { //cb here should be the same fn as cb above
        mySQL.signUpWithInfo(username, password, function(deckLists, user, errMessage) {
            if (errMessage === null) {                    //user is {userID: _ , username: _ }
                signedInUserSockets[user.username] = socket;
                numConnectedUsers++;
                console.log("User " + user.username + " connected; " + numConnectedUsers + " users now connected");
            }
            cb(deckLists, user, errMessage);
        });
    });
    socket.on('saveDeck', function(deckID, name, deckList, user, cb) {
        if (parseInt(deckID) < 0)
            mySQL.saveDeckListForUser(name, deckList, user, cb);
        else
            mySQL.updateDeckList(deckID, name, deckList, cb);
    });
    socket.on('deleteDeck', function(deckID, cb) {
        mySQL.deleteDeckList(deckID, cb);
    });
    socket.on('challengeAFriend', function(challengerUsername, friendUsername, cb) {
        var friendSocket = signedInUserSockets[friendUsername];
        if (friendSocket !== undefined && friendSocket !== null) {
            friendSocket.emit('receiveChallenge', challengerUsername);
            cb();
        }
        else {
            cb("User isn't online or doesn't exist");
        }
    });
    socket.on('acceptOrDeclineChallenge', function(challengeIniatorUsername, challegeResponderUsername, challengeWasAccepted) {
        signedInUserSockets[challengeIniatorUsername].emit('receiveChallengeResponse', challengeWasAccepted, challegeResponderUsername);
    });
    socket.on('disconnect', function () {
        let username;
        for (var key of Object.keys(signedInUserSockets)) {
            if (signedInUserSockets[key] === socket) {
                username = key;
                break;
            }
        }
        if (username !== undefined) {
            numConnectedUsers--;
            delete signedInUserSockets[username];
            console.log("User " + username + " disconnected; " + numConnectedUsers + " users now connected");
        }
        else {
            console.log("Non-signed-in socket disconnected");
        }
        let shouldBreak = false, roomName, index;
        for (var room of Object.keys(rooms)) {
            let sockets = rooms[room];
            for (let i = 0; i < sockets.length; i++) {
                if (sockets[i].id === socket.id) {
                    shouldBreak = true;
                    roomName = room;
                    index = i;
                    break;
                }
            }
            if (shouldBreak) break;
        }
        if (shouldBreak) {
            rooms[roomName].splice(index, 1);
        }
    });
    socket.on('joinRoom', function(roomName) {
        socket.join(roomName);
        if (rooms[roomName] !== undefined) {
            rooms[roomName].push(socket);
        }
        else {
            rooms[roomName] = [socket];
        }
        if (rooms[roomName].length === 2) {
            for (var soc of rooms[roomName]) {
                soc.emit('resumeActivities');
            }
        }
    });
    socket.on('broadcastToRoom', function(roomName, functionName, args) {
        console.log(functionName);
        console.log(args);
        socket.broadcast.to(roomName).emit(functionName, args);
    });
});
