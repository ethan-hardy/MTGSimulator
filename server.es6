'use strict';
let express = require('express');
let app = express();
let server = app.listen(8000, () => {
    console.log('Server started at 8000');
});
app.use('/', express.static('./public_html'));

let io = require('socket.io')(server);
let mySQL = require('./databaseMySQL.es6');


io.on('connection', (socket) => {
    socket.on('signInWithInfo', function(username, password, cb) { //cb should have the form fn(deckLists, username, errMessage)
        mySQL.deckListsForUser(username, password, cb);
    });
    socket.on('signUpWithInfo', function(username, password, cb) { //cb here should be the same fn as cb above
        mySQL.signUpWithInfo(username, password, cb);
    });
    socket.on('saveDeck', function(deckID, name, deckList, user, cb) {
        if (parseInt(deckID) < 0)
            mySQL.saveDeckListForUser(name, deckList, user, cb);
        else
            mySQL.updateDeckList(deckID, name, deckList, cb);
    });
});
