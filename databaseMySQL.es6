"use strict";
let db = require("node-mysql");
let mySQL = require("mysql");

function makeConnection(cb) {
    var con = mySQL.createConnection({
        host: "localhost",
        user: "ethan",
        password: "ethan4526",
        database: "mtgDB"
    });
    con.connect(function(err) {
        //lol fuck errors
        cb(con); //TODO make it end the connection after
    });
}

var deckListsForUser = function(username, password, cb) {
    makeConnection(function(con) {
        con.query("SELECT * FROM userTable WHERE username=?", [username], function(err,data) {
            if (data.length === 0) cb(null, null, "Unrecognized username");
            else if (data[0].password !== password) cb(null, null, "Incorrect password");
            else {
                con.query("SELECT deckID, deckName, deckList FROM deckTable WHERE userID='"+data[0].userID+"'",function(err2,data2) {
                    cb(data2, data[0], null);
                });
            }
        });
    });
};

var saveDeckListForUser = function(name, deckList, user, cb) {
    makeConnection(function(con) {
        let queryString = "INSERT INTO deckTable (userID, deckName, deckList) VALUES (?, ?, ?)";
        con.query(queryString, [user.userID, name, deckList], function(err,res){
            if (err === null) cb({code: "Saved", id: res.insertId});
            else {
                console.log("Error caused by query:\n" + queryString + " , " + user.userID + " , " + name + " , " + deckList);
                cb(err);
            }
        });
    });
};

var updateDeckList = function(deckID, name, deckList, cb) {
    makeConnection(function(con) {
        let queryString = "UPDATE deckTable SET deckName=?, deckList=? WHERE deckID=?";
        con.query(queryString, [name, deckList, deckID], function(err,res){
            if (err === null) cb({code: "Saved", id: res.insertId});
            else {
                console.log("Error caused by query:\n" + queryString + " , " + name + " , " + deckList + " , " + deckID);
                cb(err);
            }
        });
    });
};

var signUpWithInfo = function(username, password, cb) {
    makeConnection(function(con) {
        let queryString = "INSERT INTO userTable (username, password) VALUES (?, ?)";
        con.query(queryString, [username, password], function(err,res){
            if (err === null) deckListsForUser(username, password, cb);
            else {
                console.log("Error caused by query:\n" + queryString + " , " + username + " , " + password);
                cb(null, null, err);
            }
        });
    });
};


module.exports = {deckListsForUser: deckListsForUser, saveDeckListForUser: saveDeckListForUser, updateDeckList: updateDeckList, signUpWithInfo: signUpWithInfo};
