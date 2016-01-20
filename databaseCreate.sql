CREATE DATABASE mtgDB;
CREATE USER 'ethan'@'localhost' IDENTIFIED BY 'ethan4526';
USE mtgDB;
GRANT ALL PRIVILEGES ON mtgDB.* TO 'ethan'@'localhost' WITH GRANT OPTION;
CREATE TABLE userTable
(
  userID INT UNSIGNED NOT NULL auto_increment primary key,
  username VARCHAR(20),
  password VARCHAR(128)
);
CREATE TABLE deckTable
(
  deckID INT UNSIGNED NOT NULL auto_increment primary key,
  userID INT UNSIGNED NOT NULL,
  FOREIGN KEY (userID) REFERENCES userTable(userID),
  deckName VARCHAR(40),
  decklist TEXT
);
