"use strict";
(function() {
  $("#battlefield").height(window.innerHeight - $(".playerSection").outerHeight(true) * 2 - 16 - $('.menuBar').height() * 2);
  $('#yourMenuBar').offset({top: $('#cardLayer').height() + $('.menuBar').height() + 8});
  var cardImageLinkBase = "http://gatherer.wizards.com/Handlers/Image.ashx?type=card&name=";
  var socket, roomName, opponentUsername, yourUsername;
  var landList;
  var isMultiplayerSession = false;

  if (sessionStorage.isHost !== undefined) {
      yourUsername = sessionStorage.yourUsernameStore;
      let objs = JSON.parse(sessionStorage[yourUsername]);
      opponentUsername = objs.opponentUsername;
      console.log(opponentUsername);
      isMultiplayerSession = true;
      if (objs.isHost === "true") {
          roomName = yourUsername + "'s and " + opponentUsername + "'s match room";
      }
      else {
          roomName = opponentUsername + "'s and " + yourUsername + "'s match room";
      }
      socket = io();
      socket.emit('joinRoom', roomName);

      socket.on('moveCardToSpot', function(args/*{card, spotIndex}*/) {
          //this shouldn't be called with a card that doesn't exist on the receiving end
          //the spotIndex passed is the SENDER's spot; this function then converts it
          if (args.spotIndex < battlefieldRange.min || args.spotIndex > battlefieldRange.max) { //not on the battlefield
              let battlefieldSize = (battlefieldRange.max - battlefieldRange.min + 1);
              let row = battlefieldSize / (args.spotIndex - battlefieldRange.min), rowSize = battlefieldSize / 4;
              let destinationRow = 3 - row;
              let column = rowSize % (args.spotIndex - battlefieldRange.min);
              args.spotIndex = destinationRow * rowSize + column + battlefieldRange.min;
          }
          else if (args.spotIndex > cardSpots.length / 2) {
              args.spotIndex = oppExileIndex - (cardSpots.length - args.spotIndex - 1);
          }
          else {
              args.spotIndex = cardSpots.length - (oppExileIndex - args.spotIndex - 1);
          }
          addCardToSpot(args.card, args.spotIndex);
      });

      socket.on('receiveDeckList', function(args/*newDeckList, newDeckOrderedList, numCardsToRedraw*/) { //numCardsToRedraw = -1 for no change
          if (args.numCardsToRedraw >= 0) {  //the new decklists must be passed BEFORE drawing the cards
              for (var i = oppHandRange.min; i < oppHandRange.max; i++) {
                  while (cardSpots[i].cards.length > 0) {
                      keyBindings.Y(cardSpots[i].cards[0]);
                  }
              }
          }
          keyBindings.Y(cardSpots[oppLibraryIndex].cards[0]);
          oppLibraryList = args.newDeckList;
          oppLibrarySortedList = args.newDeckOrderedList;
          placeNextCardFromLibrary(false);
          addOrRemoveCardFromSortedList(false, oppLibraryList.pop(), oppLibrarySortedList);
          if (args.numCardsToRedraw >= 0) {
              drawCardsFromDeck(false, args.numCardsToRedraw);
          }
          $('#oppCardSelect').trigger('change');
      });

  }

  class mtgCard {
     // var isTapped, isFaceDown, isYourCard;
     // var name, card;
      constructor(nameParam, isYourCardP, cardP, zoneP) {
          var _name = nameParam;
          this.isYourCard = isYourCardP;
          this.card = cardP;
          this.isFaceDown = true;
          this.isTapped = false;
          this.zone = zoneP;
          this.isLand = undefined;
          this.isZoomed = false;
          this.zoomedOutOffset = null;
          var _numCounters = 0;

          this.setNumCounters = function(num) {
              _numCounters = (num >= 0) ? num : 0;
              if (num > 0) {
                  $(this.card).find('p').text(num.toString() + 'c').css('color', 'rgb(209, 209, 185)');
              }
              else {
                  $(this.card).find('p').css('color', 'rgba(0, 0, 0, 0)');
              }
          };
          this.getNumCounters = function() {
              return _numCounters;
          };
          this.setName = function(cardName) {
              _name = cardName;
              if (!this.isFaceDown)
                $(this.card).css("background-image", "url(" + cardImageLinkBase + _name + ")");
          };
          this.getName = function() {
              return _name;
          };

          this.setIsLand();

      }

      setIsLand() {
          if (landList === undefined) return;
          this.isLand = false;
          let curName = parseRegExString(this.getName());
          for (var landName of landList) {
              if (landName === curName) {
                  this.isLand = true;
                  break;
              }
          }
      }

      flip () {
          if (this.isFaceDown === false) {
              $(this.card).css("background-image", "url(" + cardImageLinkBase + "back" + ")");
              this.isFaceDown = true;
          }
          else {
              $(this.card).css("background-image", "url(" + cardImageLinkBase + this.getName() + ")");
              this.isFaceDown = false;
          }
          if (this.isLand === undefined) {
              this.setIsLand();
          }
      }

      static mtgCardFromCard(card) {
          return cardsInGame[$(card).attr('id')];
      }

  }

  var lastPosition;
  var cardSpacing = {x: 35, y: 5};
  var cardSize = {width: 76, height: 105}, cardOffset = {x: 6, y: 16};

  var cardSpots = [];
  var numCards = 0, zIndexCount = 0;
  var mouseHasMoved = false;
  var yourGraveyardIndex, oppGraveyardIndex, yourLibraryIndex, oppLibraryIndex, battlefieldRange = {min: -1, max: 0},
        yourExileIndex, oppExileIndex, yourHandRange = {min: -1, max: 0}, oppHandRange = {min: -1, max: 0};

  var retY = splitDeckList(sessionStorage.yourListText), retO = splitDeckList(sessionStorage.oppListText);
  var yourLibraryList = retY.fullList, yourLibraryListHold = yourLibraryList.slice(), yourLibrarySortedList = retY.sortedNumberedList;
  var oppLibraryList = retO.fullList, oppLibraryListHold = oppLibraryList.slice(), oppLibrarySortedList = retO.sortedNumberedList;

  var cardsInGame = [];

  function splitDeckList(deckListText) {
      if (deckListText === undefined || deckListText === null || deckListText.length <= 0) {
          return {fullList: [], sortedNumberedList: []};
      }
      let sortedNumberedList = [], fullList = [], oldNewLine = -1, newNewLine = deckListText.indexOf('\n');
      let line, numCopies, cardName, shouldBreak = false;
      while (!shouldBreak) {
          if (newNewLine === -1) {
              newNewLine = deckListText.length;
              shouldBreak = true;
          }
          line = deckListText.substring(oldNewLine+1, newNewLine);
          cardName = line.substring(line.indexOf(' ') + 1);
          let ind = line.indexOf(' ');
          numCopies = parseInt(line.substring(0, ind));
          if (isNaN(numCopies)) numCopies = parseInt(line.substring(0, ind-1));
          if (isNaN(numCopies)) {
              numCopies = 1;
              cardName = line;
          }
          var broke = false;
          var titledCardName = titleizeString(cardName);
          for (var i = 0; i < sortedNumberedList.length; i++) {
              if (sortedNumberedList[i].cardName == titledCardName) {
                  sortedNumberedList[i].numCopies += numCopies;
                  broke = true;
                  break;
              }
          }
          if (!broke) sortedNumberedList.push({cardName: titledCardName, numCopies: numCopies});
          var linkParsedCard = regExEncodeString(cardName);
          for (var j = 0; j < numCopies; j++) {
              fullList.push(linkParsedCard);
          }
          oldNewLine = newNewLine;
          newNewLine = deckListText.indexOf('\n', oldNewLine+1);
      }
      sortedNumberedList.sort(function(a, b) {
          return a.cardName.localeCompare(b.cardName);
      });
      shuffle(fullList);
      return {sortedNumberedList: sortedNumberedList, fullList: fullList};
  }

  function shuffleDeck(isYourDeck) {
      if (isYourDeck) {
          yourLibraryList = shuffle(yourLibraryList);
          cardsInGame[$(cardSpots[yourLibraryIndex].cards[0]).attr('id')].setName(yourLibraryList[0]);
      }
      else {
          oppLibraryList = shuffle(oppLibraryList);
          cardsInGame[$(cardSpots[oppLibraryIndex].cards[0]).attr('id')].setName(oppLibraryList[0]);
      }
  }

  function shuffle(array) {
      let temp, r;
      for (var i = array.length - 1; i > 0; i--) {
          r = Math.floor(Math.random() * i);
          temp = array[i];
          array[i] = array[r];
          array[r] = temp;
      }
      return array;
  }

  var cardMouseDown = function(e) {
    if ($(e.target).hasClass('card')) {
        lastPosition = {card: e.target, x: e.clientX, y: e.clientY};
    }
    mouseHasMoved = false;
  };

  var libraryMouseDown = function(e) {
      if ($(e.target).hasClass("library")) {
          var isInYourLibrary = false;
          if (e.clientY > $(document).height() / 2) {
              isInYourLibrary = true;
          }
      }
  };

  function addCardToSpot(card, spotIndex) {
      if (isMultiplayerSession) {
          socket.emit('broadcastToRoom', roomName, 'moveCardToSpot', {card: card, spotIndex: spotIndex});
        //   socket.to(roomName).emit('moveCardToSpot', card, spotIndex);
      }
      var index;
      removeCardFromSpot(card);
      var cardData = mtgCard.mtgCardFromCard(card);
      cardData.zone = cardSpots[spotIndex].zone;
      if (cardData.isFaceDown) cardData.flip();
      if ($(card).hasClass('library')) $(card).removeClass('library');
      var xOff = cardOffset.x, yOff = cardOffset.y;
      var completionHandler;
      if (cardSpots[spotIndex].zone.indexOf('Library') >= 0) {
          if (cardSpots[spotIndex].cards.length !== 0) {
              if (spotIndex === oppLibraryIndex) {
                  oppLibraryList.push(cardData.getName());
                  addOrRemoveCardFromSortedList(true, cardData.getName(), oppLibrarySortedList);
              }
              else {
                  yourLibraryList.push(cardData.getName());
                  addOrRemoveCardFromSortedList(true, cardData.getName(), yourLibrarySortedList);
              }
              var cardToRemove = cardSpots[spotIndex].cards.pop();
              cardSpots[spotIndex].cards.push(card);
              index = $(cardToRemove).attr('id');
              completionHandler = function() {
                  $(cardToRemove).remove();
              };
              for (var i = parseInt(index) + 1; i < cardsInGame.length; i++) {
                  $('#' + i.toString()).attr('id', i-1);
                  cardsInGame[i-1] = cardsInGame[i];
              }
              cardsInGame.pop();
          }
          numCards--;
          xOff = 0;
          yOff = 0;
          if (!cardData.isFaceDown) cardData.flip();
          if (!$(card).hasClass('library')) $(card).addClass('library');
      }
      else {
          cardSpots[spotIndex].cards.push(card);
          if (cardSpots[spotIndex].zone.indexOf('Graveyard') >= 0 || cardSpots[spotIndex].zone.indexOf('Exile') >= 0) {
              xOff = 0;
              yOff = 0;
          }
      }
      if (cardSpots[spotIndex].zone !== 'battlefield') cardData.setNumCounters(0);
      index = 0;
      var lastZIndex;
      for (let curCard of cardSpots[spotIndex].cards) {
          if (lastZIndex === undefined) lastZIndex = $(curCard).css('z-index');
          else lastZIndex++;
          if (shouldAnimate) {
              $(curCard).animate({
                  top: cardSpots[spotIndex].y + index * yOff,
                  left: cardSpots[spotIndex].x + index * xOff
              }, 100, "swing", completionHandler).css('z-index', lastZIndex);
          }
          else {
              $(curCard).css({
                  top: cardSpots[spotIndex].y + index * yOff,
                  left: cardSpots[spotIndex].x + index * xOff,
                  'z-index': lastZIndex
              });
          }
          index++;
      }
  }

  function titleizeString(str) {
      if (str.charAt(0) !== ' ') str = str[0].toUpperCase() + str.slice(1);
      for (var i = 1; i < str.length; i++) {
          if (str[i-1] === ' ' || str.substr(i-3, 3) === '%20') {
              str = str.slice(0, i) + str[i].toUpperCase() + str.slice(i + 1);
          }
      }
      return str;
  }

  function parseRegExString(str) {
      return titleizeString(str.replace(/%20/g, ' ').replace(/%27/g, "'"));
  }

  function regExEncodeString(str) {
      return titleizeString(str.replace(/ /g, '%20').replace(/'/g, '%27'));
  }

  function addOrRemoveCardFromSortedList(shouldAdd, cardName, sortedList) {
      cardName = parseRegExString(cardName);
      var increment = (shouldAdd) ? 1 : -1, i = 0, indexToRemove = null, broke = false;
      for (var element of sortedList) {
          if (element.cardName == cardName) {
              if ((sortedList[i].numCopies += increment) <= 0) {
                  indexToRemove = i;
              }
              broke = true;
              break;
          }
          i++;
      }
      if (broke === false) { //means the card's not already in the deck (we can't be removing it)
          if (!shouldAdd) {
              console.log("didn't find card in deck but you're trying to remove it!!");
              return;
          }
          sortedList.push({cardName: cardName, numCopies: 1});
          if (sortedList == yourLibrarySortedList)
              $('#yourCardSelect').append("<option>" + cardName + "</option>");
          else
              $('#oppCardSelect').append("<option>" + cardName + "</option>");
      }
      else if (indexToRemove !== null) { //means the card exists in the deck already and we're taking it out
          sortedList.splice(indexToRemove, 1);
          var curSelect = (sortedList == yourLibrarySortedList) ? $('#yourCardSelect') : $('#oppCardSelect');
          var optionList = curSelect.children();
          for (i = 0; i < optionList.length; i++) {
              let option = optionList[i];
              if ($(option).text() === cardName) {
                  $(option).remove();
                  curSelect.trigger('change');
                  break;
              }
          }

      }
  }

  function removeCardFromSpot(card) {
      var removedSpot;
      mtgCard.mtgCardFromCard(card).zone = undefined;
      for (var spot of cardSpots) {
          var index = spot.cards.indexOf(card);
          if (index >= 0) {
              spot.cards.splice(index, 1);
              removedSpot = spot;
          }
      }
      if (removedSpot !== undefined) {
          var index = 0;
          var xOff = cardOffset.x, yOff = cardOffset.y;
          if (removedSpot.zone.indexOf('Library') >= 0) {
              xOff = 0;
              yOff = 0;
              (mtgCard.mtgCardFromCard(card).isYourCard) ? addOrRemoveCardFromSortedList(false, yourLibraryList.pop(), yourLibrarySortedList) : addOrRemoveCardFromSortedList(false, oppLibraryList.pop(), oppLibrarySortedList);
              placeNextCardFromLibrary(mtgCard.mtgCardFromCard(card).isYourCard);
          }
          else if (removedSpot.zone.indexOf('Graveyard') >= 0 || removedSpot.zone.indexOf('Exile') >= 0) {
              xOff = 0;
              yOff = 0;
          }
          for (var curCard of removedSpot.cards) {
              if (shouldAnimate) {
                  $(curCard).animate({
                      top: removedSpot.y + index * yOff,
                      left: removedSpot.x+ index * xOff
                  }, 100, "swing");
              }
              else {
                  $(curCard).css({
                      top: removedSpot.y + index * yOff,
                      left: removedSpot.x+ index * xOff
                  });
              }
              index++;
          }
      }
  }

  function placeNextCardFromLibrary(isYourLibrary) {
      if (isYourLibrary && yourLibraryList.length === 0 || !isYourLibrary && oppLibraryList.length === 0) return;
      var spot = (isYourLibrary) ? cardSpots[yourLibraryIndex] : cardSpots[oppLibraryIndex];
      var cardToPlace = $("<div>")
            .addClass('card library')
            .attr('id', numCards.toString())
          .css({
              height: cardSize.height,
              width: cardSize.width,
              left: spot.x,
              top: spot.y
          })
          .mousedown(libraryMouseDown)
          .mousedown(cardMouseDown)
          .hover(function(e) {
              $(e.target).addClass('hovered');
          }, function(e) {
              $(e.target).removeClass('hovered');
          })[0];
      $("#cardLayer").append(cardToPlace);
      var xOffset = 8;
      $(cardToPlace).append($("<p class='infoBox'>")
            .text('0c')
            .offset({top: cardSize.height, left: xOffset})
            .width(cardSize.width)
            .css({
                'color': 'rgba(0, 0, 0, 0)',
                'text-align': 'left',
                'font-size': '0.8em'
            })
            .hover(function(e) {
                $(e.target).parent().removeClass('hovered');
                e.stopPropagation();
            }, function(e) {
                var par = $(e.target).parent();
                if (e.clientX >= par.offset().left && e.clientX <= par.offset().left + cardSize.width &&
                    e.clientY <= $(e.target).offset().top && !par.hasClass('hovered'))
                    par.addClass('hovered');
                e.stopPropagation();
            })
      );
      spot.cards.push(cardToPlace);
      if (isYourLibrary) {
          cardsInGame.push(new mtgCard(yourLibraryList[yourLibraryList.length-1], true, $('#'+numCards.toString()), ('yourLibrary')));
      }
      else {
          cardsInGame.push(new mtgCard(oppLibraryList[oppLibraryList.length-1], false, $('#'+numCards.toString()), ('oppLibrary')));
      }
      numCards++;
  }

  $(".zone").each(function(index, zone) {
      var wid = $(zone).width(), hgt = $(zone).height();
      var initialX = cardSpacing.x, initialY = cardSpacing.y;
      if (2 * cardSpacing.x + cardSize.width > wid) {
          initialX = -3;//(wid - cardSize.width) / 2;
      }
      if (2 * cardSpacing.y + cardSize.height > hgt) {
          initialY = 0;//(hgt - cardSize.height) / 2;
      }
      if ($(zone).attr('id') !== "battlefield") {
          initialY = 12.5;
      }
      for (var x = initialX; x + initialX + cardSize.width <= wid; x += (cardSpacing.x + cardSize.width)) {
          if (initialY == 12.5) {
              var y = initialY;
              cardSpots.push({x: x + $(zone).offset().left, y: y + $(zone).offset().top - $('.menuBar').height(), cards: [], zone: $(zone).attr('id')});
              switch ($(zone).attr('id')) {
                  case 'oppHand':
                    if (oppHandRange.min === -1)
                        oppHandRange = {min: cardSpots.length-1, max: cardSpots.length-1};
                    else
                        oppHandRange.max++;
                    break;
                  case 'oppLibrary':
                    oppLibraryIndex = cardSpots.length-1;
                    break;
                  case 'oppGraveyard':
                    oppGraveyardIndex = cardSpots.length-1;
                    break;
                  case 'oppExile':
                    oppExileIndex = cardSpots.length-1;
                    break;
                  case 'yourHand':
                    if (yourHandRange.min === -1)
                        yourHandRange = {min: cardSpots.length-1, max: cardSpots.length-1};
                    else
                        yourHandRange.max++;
                    break;
                  case 'yourLibrary':
                    yourLibraryIndex = cardSpots.length-1;
                    break;
                  case 'yourGraveyard':
                    yourGraveyardIndex = cardSpots.length-1;
                    break;
                  case 'yourExile':
                    yourExileIndex = cardSpots.length-1;
                    break;
              }
          }
          else {
              if (battlefieldRange.min === -1)
                  battlefieldRange = {min: cardSpots.length-1, max: cardSpots.length-2};
              for (var y = initialY; y + initialY / 2 + cardSize.height <= hgt / 2; y += (cardSpacing.y + cardSize.height)) {
                  battlefieldRange.max += 2;
                  cardSpots.push({x: x + $(zone).offset().left, y: y + $(zone).offset().top - 8 - $('.menuBar').height(), cards: [], zone: $(zone).attr('id')});
                  cardSpots.push({x: x + $(zone).offset().left, y: hgt - y - cardSize.height + $(zone).offset().top - 8 - $('.menuBar').height(), cards: [], zone: $(zone).attr('id')});
              }
          }
      }
  })

  $('.menuBarSelect').hover(function(e) {
          $(e.target).addClass('hovered');
      }, function(e) {
          $(e.target).removeClass('hovered');
      });

  for (let card of oppLibrarySortedList) {
      $('#oppCardSelect').append("<option>" + card.cardName + "</option>");
  }
  for (let card of yourLibrarySortedList) {
      $('#yourCardSelect').append("<option>" + card.cardName + "</option>");
  }

  placeNextCardFromLibrary(true);
  addOrRemoveCardFromSortedList(false, yourLibraryList.pop(), yourLibrarySortedList);
  if (!isMultiplayerSession) {
      placeNextCardFromLibrary(false);
      addOrRemoveCardFromSortedList(false, oppLibraryList.pop(), oppLibrarySortedList);
  }


  $('.numCounterSelect').each(function(index, obj) {
      for (var i = 0; i <= 300; i++) {
          $(obj).append('<option>' + i.toString() + '</option>');
      }
      if (obj.previousSibling.data.substr(0, 6) === 'Poison') $(obj).val('10').prop('selected', true);
      else  $(obj).val('20').prop('selected', true);
  }).change(function() {
      $(this.previousSibling).replaceWith(this.previousSibling.data.split(' ')[0] + ' ' + $(this).val().toString());
  });

  $('.drawNumberSelect').each(function(index, obj) {
      for (var i = 1; i <= 7; i++) {
          $(obj).append('<option>' + i.toString() + '</option>');
          $(obj).val('7').prop('selected', true);
      }
      $(this).on("click", function(e) {
          e.stopPropagation();
      });
  });

  $('#oppCardSelect').change(function() {
      $(this.previousSibling).replaceWith($(this).val().toString());
  });
  if (!isMultiplayerSession) {
      $('#oppCardSelect').trigger('change');
  }

  $('#yourCardSelect').change(function() {
      $(this.previousSibling).replaceWith($(this).val().toString());
  }).trigger('change');

  $('.drawCardsButton').on('click', function() {
      let numCardsToDraw = $(this).find('.drawNumberSelect').val();
      let isYourDeck = $.contains($('#yourMenuBar')[0], this);
      let indexRange = (isYourDeck) ? yourHandRange : oppHandRange;
      //shouldAnimate = false;
      for (var i = indexRange.min; i <= indexRange.max; i++) {
          for (let card of cardSpots[i].cards)
              keyBindings.Y(card);
      }
      shouldAnimate = true;
      if (isYourDeck)
          $('#yourMenuBar .shuffleButton').trigger('click');
      else
          $('#oppMenuBar .shuffleButton').trigger('click');
      setTimeout(function() {
          drawCardsFromDeck(numCardsToDraw, isYourDeck);
      }, 300);
  });

  var shouldAnimate = true;

  var keyBindings = {
     T: function(card) { //tap
         var cardData = mtgCard.mtgCardFromCard(card);
         if ($(card).hasClass('library') || cardData.isZoomed) return;
         if (cardData.isTapped === true) {
             $(card).css({
                 'transform': 'inherit'
             });
             cardData.isTapped = false;
         }
         else {
             $(card).css({
                 'transform': 'rotate(90deg)'
             });
             cardData.isTapped = true;
         }
     },
     G: function(card) { //graveyard
         let cardData = mtgCard.mtgCardFromCard(card);
         if (cardData.isZoomed) return;
         var destinationIndex = oppGraveyardIndex;
         if (cardData.isYourCard === true) {
             destinationIndex = yourGraveyardIndex;
         }
         addCardToSpot(card, destinationIndex);
     },
     Y: function(card) { //top of library
         let cardData = mtgCard.mtgCardFromCard(card);
         if (cardData.isZoomed) return;
         var destinationIndex = oppLibraryIndex;
         if (cardData.isYourCard === true) {
             destinationIndex = yourLibraryIndex;
         }
         addCardToSpot(card, destinationIndex);
     },
     U: function(card) { //bottom of library
         let cardData = mtgCard.mtgCardFromCard(card);
         if (cardData.isZoomed) return;
         let index = parseInt($(card).attr('id'));
         if (cardsInGame[index].isYourCard === true) {
             yourLibraryList.splice(0, 0, cardsInGame[index].getName());
             addOrRemoveCardFromSortedList(true, cardsInGame[index].getName(), yourLibrarySortedList);
         }
         else {
             oppLibraryList.splice(0, 0, cardsInGame[index].getName());
             addOrRemoveCardFromSortedList(true, cardsInGame[index].getName(), oppLibrarySortedList);
         }
         removeCardFromSpot(card);
         $(card).remove();
         for (var i = parseInt(index) + 1; i < cardsInGame.length; i++) {
             $('#' + i.toString()).attr('id', i-1);
             cardsInGame[i-1] = cardsInGame[i];
         }
         cardsInGame.pop();
         numCards--;
     },
     X: function(card) { //exile
         let cardData = mtgCard.mtgCardFromCard(card);
         if (cardData.isZoomed) return;
         var destinationIndex = oppExileIndex;
         if (cardData.isYourCard === true) {
             destinationIndex = yourExileIndex;
         }
         addCardToSpot(card, destinationIndex);
     },
     B: function(card) { //battlefield
         var cardData = mtgCard.mtgCardFromCard(card);
         if (cardData.isZoomed) return;
         var yCoord; //rowSize = (battlefieldRange.max - battlefieldRange.min + 1) / 4;
         if (cardData.isYourCard) {
             if (cardData.isLand) yCoord = $('#battlefield').height() - cardSpacing.y - cardSize.height + $('#battlefield').offset().top - 8;
             else yCoord = $('#battlefield').height() - cardSpacing.y * 2 - cardSize.height - cardSize.height + $('#battlefield').offset().top - 8;
         }
         else {
             if (cardData.isLand) yCoord = cardSpacing.y + $('#battlefield').offset().top - 8;
             else yCoord = 2 * cardSpacing.y + cardSize.height + $('#battlefield').offset().top - 8;
         }
         var minX = 300000, currentSpotIndex;
         for (var i = battlefieldRange.min; i <= battlefieldRange.max; i++) {
             if (cardSpots[i].y === yCoord - $('.menuBar').height() && cardSpots[i].cards.length === 0 && cardSpots[i].x <= minX) {
                 minX = cardSpots[i].x;
                 currentSpotIndex = i;
             }
         }
         if (currentSpotIndex !== undefined) {
             addCardToSpot(card, currentSpotIndex);
         }
     },
     A: function(card) {
         let cardData = mtgCard.mtgCardFromCard(card);
         if (cardData.isZoomed) return;
         var destinationRange = oppHandRange;
         if (cardData.isYourCard === true) {
             destinationRange = yourHandRange;
         }
         let destinationIndex, minCards = 400;
         for (var i = destinationRange.min; i <= destinationRange.max; i++) {
             if (cardSpots[i].cards.length < minCards) {
                 minCards = cardSpots[i].cards.length;
                 destinationIndex = i;
             }
         }
         addCardToSpot(card, destinationIndex);
     },
     E: function(card) {
         var cardData = mtgCard.mtgCardFromCard(card);
         if (cardData.zone === 'battlefield' && !cardData.isZoomed)
           cardData.setNumCounters(cardData.getNumCounters() + 1);
     },
     W: function(card) {
         var cardData = mtgCard.mtgCardFromCard(card);
         if (cardData.zone === 'battlefield' && !cardData.isZoomed)
           cardData.setNumCounters(cardData.getNumCounters() - 1);
     },
     space: function(card) {
         if (cardIsCurrentlyZooming) {
             console.log("zooming");
             return;
         }
         let cardData = mtgCard.mtgCardFromCard(card);
         let isZoomingIn = !cardData.isZoomed;
         if (isZoomingIn) cardData.isZoomed = true;
         let sizeMultiplier = (isZoomingIn) ? 2.5 : 1.0 / 2.5;
         let values = {width: $(card).width(), height: $(card).height(), top: $(card).offset().top, left: $(card).offset().left};
         let destinationOffset = {left: values.left - values.width * (sizeMultiplier - 1) / 2,
                                    top:  values.top - values.height * (sizeMultiplier - 1) / 2};
         let minTop = $("#oppHand").offset().top;
         let minLeft = $("#battlefield").offset().left;
         if (isZoomingIn) {
             cardData.zoomedOutOffset = {left: values.left, top: values.top};
             $(card).css('z-index', zIndexCount++ + 1);
             let maxTop = $("#yourHand").offset().top + $("#yourHand").height() - values.height * sizeMultiplier;
             let maxLeft = $("#battlefield").offset().left + $("#battlefield").width() - values.width * sizeMultiplier;
             if (destinationOffset.left < minLeft) destinationOffset.left = minLeft;
             else if (destinationOffset.left > maxLeft) destinationOffset.left = maxLeft;
             if (destinationOffset.top < minTop) destinationOffset.top = minTop;
             else if (destinationOffset.top > maxTop) destinationOffset.top = maxTop;


             $(card).mouseleave(function() {
                 $(card).unbind("mouseleave")
                        .mouseleave(function(e) {
                            $(e.target).removeClass('hovered');
                        });
                 cardIsCurrentlyZooming = true;
                 $(card).animate({width: values.width,
                                  height: values.height,
                                  top: ((!isZoomingIn) ? cardData.zoomedOutOffset.top : values.top) - minTop,
                                  left: ((!isZoomingIn) ? cardData.zoomedOutOffset.left :values.left) - minLeft},
                                  100,
                                  "swing",
                                  function() {
                                      cardData.isZoomed = false;
                                      $(card).append(heldZoomedCardInfoBoxJQuery);
                                      cardIsCurrentlyZooming = false;
                                  });
             });
             heldZoomedCardInfoBoxJQuery = $(card).find('.infoBox').detach();
         }
         cardIsCurrentlyZooming = true;
         $(card).animate({width: values.width * sizeMultiplier,
                          height: values.height * sizeMultiplier,
                          top: ((!isZoomingIn) ? cardData.zoomedOutOffset.top : destinationOffset.top) - minTop,
                          left: ((!isZoomingIn) ? cardData.zoomedOutOffset.left : destinationOffset.left) - minLeft},
                          100,
                          "swing",
                          function() {
                              if (!isZoomingIn) {
                                  cardData.isZoomed = false;
                                  $(card).append(heldZoomedCardInfoBoxJQuery);
                                  $(card).unbind("mouseleave")
                                         .mouseleave(function(e) {
                                             $(e.target).removeClass('hovered');
                                         });
                              }
                              cardIsCurrentlyZooming = false;
                          });
     }
 };

 var heldZoomedCardInfoBoxJQuery, cardIsCurrentlyZooming = false;

 function drawCardsFromDeck(numCards, isYourDeck) {
     var indexOfCard = (isYourDeck) ? yourLibraryIndex : oppLibraryIndex;
     for (var i = 0; i < numCards; i++) {
         keyBindings.A(cardSpots[indexOfCard].cards[0]);
     }
 }

 $.get('http://localhost:8000/resources/list.txt', function(data) {
     landList = data.split('\n');
     drawCardsFromDeck(7, true);
     if (!isMultiplayerSession) drawCardsFromDeck(7, false);
 });



  $('.restartButton').on('click', function() {
      for (var spot of cardSpots) {
          spot.cards.splice(0, spot.cards.length);
      }
      cardsInGame.splice(0, cardsInGame.length);
      $('#cardLayer').empty();
      yourLibraryList = shuffle(yourLibraryListHold.slice());
      /*newDeckList, newDeckOrderedList, numCardsToRedraw*/
      if (isMultiplayerSession) {
          socket.emit('broadcastToRoom', roomName, 'receiveDeckList', {newDeckList: yourLibraryList, newDeckOrderedList: yourLibrarySortedList , numCardsToRedraw: 7});
        //   socket.to(roomName).emit('receiveDeckList', yourLibraryList, yourLibrarySortedList, 7);
      }
      else oppLibraryList = shuffle(oppLibraryListHold.slice());
      numCards = 0;
      placeNextCardFromLibrary(true);
      placeNextCardFromLibrary(false);
      addOrRemoveCardFromSortedList(false, yourLibraryList.pop(), yourLibrarySortedList);
      addOrRemoveCardFromSortedList(false, oppLibraryList.pop(), oppLibrarySortedList);
      drawCardsFromDeck(7, true);
      drawCardsFromDeck(7, false);
      $('.menuBarSelect').each(function(index, obj) {
          if (obj.previousSibling.data.substr(0, 6) === 'Poison') $(obj).val('10').prop('selected', true)
          else  $(obj).val('20').prop('selected', true)
          $(obj.previousSibling).replaceWith(this.previousSibling.data.split(' ')[0] + ' ' + $(this).val().toString());
      })
      for (let card of oppLibrarySortedList) {
          $('#oppCardSelect').append("<option>" + card.cardName + "</option>");
      }
      for (let card of yourLibrarySortedList) {
          $('#yourCardSelect').append("<option>" + card.cardName + "</option>");
      }
  });

  $('.rollButton').on('click', function() {
     //1/2, 1/4, 5/6, 3/8, 4/10, 12/12, 17/20, 54/100
     var denominations = [2, 4, 6, 8, 10, 12, 20, 100];
     var outputString = '';
     for (var range of denominations) {
         outputString = outputString.concat((Math.floor(Math.random() * range) + 1).toString() + '/' + range.toString() + ', ');
     }
     alert(outputString.substr(0, outputString.length - 2));
  });

  $('.shuffleButton').on('click', function() {
      var isYours = true;
      if ($.contains($('#oppMenuBar')[0], this))
         isYours = false;
      shuffleDeck(isYours);
      if (isMultiplayerSession) {
          socket.emit('broadcastToRoom', roomName, 'receiveDeckList', {newDeckList: yourLibraryList, newDeckOrderedList: yourLibrarySortedList , numCardsToRedraw: -1});
        //   socket.to(roomName).emit('receiveDeckList', yourLibraryList, yourLibrarySortedList, -1);
      }
  });

  //$(".library").mousedown(libraryMouseDown);

  //$(".card").mousedown(cardMouseDown);

  $(window).mouseup(function() {
      if (lastPosition !== undefined) {
          var currentSpot, dist;
          if (mouseHasMoved === false) {
              var cardData = cardsInGame[$(lastPosition.card).attr('id')];
              if (cardData.isZoomed) {
                  keyBindings.space(lastPosition.card);
              }
              else if (cardData.zone.indexOf('Library') !== -1 || cardData.zone.indexOf('Graveyard') !== -1 || cardData.zone.indexOf('Exile') !== -1) {
                  keyBindings.A(lastPosition.card);
              }
              else if (cardData.zone.indexOf('Hand') !== -1) {
                  keyBindings.B(lastPosition.card);
              }
              else if (cardData.zone.indexOf('battlefield') !== -1) {
                  keyBindings.T(lastPosition.card);
              }
              lastPosition = undefined;
              return;
          }
          else {
              var minDist = $(window).width() * $(window).width();
              var cardSpot = {x: $(lastPosition.card).offset().left, y: $(lastPosition.card).offset().top};
              currentSpot = cardSpot;
              for (var spot of cardSpots) {
                  dist = (cardSpot.x - spot.x) * (cardSpot.x - spot.x) + (cardSpot.y - spot.y) * (cardSpot.y - spot.y);
                  if (minDist >= dist) {
                      minDist = dist;
                      currentSpot = spot;
                  }
              }
          }

          if ($(lastPosition.card).hasClass('library')) {
              var curCard = cardsInGame[$(lastPosition.card).removeClass('library').attr('id')];
              curCard.flip();
              if (curCard.isYourCard === true) {
                  addOrRemoveCardFromSortedList(false, yourLibraryList.pop(), yourLibrarySortedList);
              }
              else {
                  addOrRemoveCardFromSortedList(false, oppLibraryList.pop(), oppLibrarySortedList);
              }
          }

          addCardToSpot(lastPosition.card, cardSpots.indexOf(currentSpot));



          lastPosition = undefined;
      }
  });

  $(window).mousemove(function(e) {
      if (lastPosition !== undefined) {
          let cardData = cardsInGame[$(lastPosition.card).attr('id')];
          if (cardData.isZoomed) {
              mouseHasMoved = true;
              return;
          }
          if (cardData.zone !== undefined) {
              removeCardFromSpot(lastPosition.card);
              $(lastPosition.card).css('z-index', zIndexCount++ + 1);
          }
          var offset = $(lastPosition.card).offset();
          var deltaY = e.clientY - lastPosition.y;
          var deltaX = e.clientX - lastPosition.x;
          $(lastPosition.card).offset({
              top: offset.top + deltaY,
              left: offset.left + deltaX
          });
          lastPosition.x = e.clientX;
          lastPosition.y = e.clientY;
          if (mouseHasMoved === false && $(lastPosition.card).hasClass('library')) {
              placeNextCardFromLibrary(cardData.isYourCard);
          }
      }
      mouseHasMoved = true;
  });

  $(window).keydown(function(e) {
     var c = String.fromCharCode(e.which);
     var hoverCard = $('.hovered');
     if (hoverCard.hasClass('card')) {
        if (c == " ")
            keyBindings.space(hoverCard[0]);
        else
            keyBindings[c](hoverCard[0]);
     }
     else if (hoverCard.hasClass('menuBarSelect')) {
         let curList = yourLibraryList, curIndex = yourLibraryIndex;
         if (hoverCard.attr('id') === 'oppCardSelect') {
             curList = oppLibraryList;
             curIndex = oppLibraryIndex;
         }
         let curName = regExEncodeString(hoverCard[0].previousSibling.nodeValue);
         curList.splice(curList.indexOf(curName), 1);
         curList.push(curName);
         let curCard = cardSpots[curIndex].cards[0];
         mtgCard.mtgCardFromCard(curCard).setName(curName);
         keyBindings[c](curCard);
     }
  });

})();
