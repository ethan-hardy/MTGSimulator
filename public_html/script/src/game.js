"use strict";
(function() {
  $("#battlefield").height(window.innerHeight - $(".playerSection").outerHeight(true) * 2 - 16 - $('.menuBar').height() * 2);
  $('#bottomBar').offset({top: $('#cardLayer').height() + $('.menuBar').height() + 8});
  var cardImageLinkBase = "http://gatherer.wizards.com/Handlers/Image.ashx?type=card&name=";
  var landList;

  class mtgCard {
     // var isTapped, isFaceDown, isYourCard;
     // var name, card;
      constructor(nameParam, isYourCardP, cardP, zoneP) {
          this.name = nameParam;
          this.isYourCard = isYourCardP;
          this.card = cardP;
          this.isFaceDown = true;
          this.isTapped = false;
          this.zone = zoneP;
          this.isLand = undefined;
      }

      setIsLand() {
          this.isLand = false;
          for (var landName of landList) {
              if (landName.toLowerCase() === this.name) {
                  this.isLand = true;
                  break;
              }
          }
      }

      flip () {
          if (this.isFaceDown === false) {
              $(this.card).css('background-image', 'url('+ cardImageLinkBase + 'back' + ')');
              this.isFaceDown = true;
          }
          else {
              $(this.card).css('background-image', 'url('+ cardImageLinkBase + this.name + ')');
              this.isFaceDown = false;
          }
          if (this.isLand === undefined) {
              this.setIsLand();
          }
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

  var yourLibraryList = ["vryn%20wingmare", "mountain", "counterspell", "electrolyze"], yourLibraryListHold = yourLibraryList.slice();
  var oppLibraryList = ["island", "mountain", "counterspell", "electrolyze"], oppLibraryListHold = oppLibraryList.slice();

  var cardsInGame = []

  $.get('http://localhost:8000/resources/list.txt', function(data) {
      landList = data.split('\n');
  });

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
        //   if (isInYourLibrary === true && yourLibraryList.length != 0 || isInYourLibrary === false && oppLibraryList.length != 0) {
        //       placeNextCardFromLibrary(isInYourLibrary);
        //   }
      }
  };

  function addCardToSpot(card, spotIndex) {
      removeCardFromSpot(card);
      var cardData = cardsInGame[$(card).attr('id')];
      cardData.zone = cardSpots[spotIndex].zone
      if (cardData.isFaceDown) cardData.flip();
      if ($(card).hasClass('library')) $(card).removeClass('library');
      var xOff = cardOffset.x, yOff = cardOffset.y;
      var completionHandler;
      if (cardSpots[spotIndex].zone.indexOf('Library') >= 0) {
          if (cardSpots[spotIndex].cards.length !== 0) {
              var index = $(cardSpots[spotIndex].cards[0]).attr('id');
              if (spotIndex === oppLibraryIndex) oppLibraryList.push(cardsInGame[index].name);
              else yourLibraryList.push(cardsInGame[index].name);
              var cardToRemove = cardSpots[spotIndex].cards.pop();
              completionHandler = function() {
                  $(cardToRemove).remove();
              }
              for (var i = index + 1; i < cardsInGame.length; i++) {
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
      cardSpots[spotIndex].cards.push(card);
      var index = 0, lastZIndex;
      for (var card of cardSpots[spotIndex].cards) {
          if (lastZIndex === undefined) lastZIndex = $(card).css('z-index');
          else lastZIndex++;
          $(card).animate({
              top: cardSpots[spotIndex].y + index * yOff,
              left: cardSpots[spotIndex].x+ index * xOff
          }, 100, "swing", completionHandler).css('z-index', lastZIndex);
          index++;
      }
  }

  function removeCardFromSpot(card) {
      var removedSpot;
      cardsInGame[$(card).attr('id')].zone = undefined;
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
              placeNextCardFromLibrary(cardsInGame[$(card).attr('id')].isYourCard);
              (cardsInGame[$(card).attr('id')].isYourCard) ? yourLibraryList.pop() : oppLibraryList.pop();
          }
          for (var card of removedSpot.cards) {
              $(card).animate({
                  top: removedSpot.y + index * yOff,
                  left: removedSpot.x+ index * xOff
              }, 100, "swing");
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
      spot.cards.push(cardToPlace);
      if (isYourLibrary) {
          cardsInGame.push(new mtgCard(yourLibraryList[yourLibraryList.length-1], true, $('#'+numCards.toString()), ('yourLibrary')));
      }
      else {
          cardsInGame.push(new mtgCard(oppLibraryList[oppLibraryList.length-1], false, $('#'+numCards.toString()), ('oppLibrary')));
      }
      numCards++
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

  placeNextCardFromLibrary(true);
  placeNextCardFromLibrary(false);
  oppLibraryList.pop();
  yourLibraryList.pop();

  $('.menuBarSelect').each(function(index, obj) {
      for (var i = 0; i <= 300; i++) {
          $(obj).append('<option>' + i.toString() + '</option>');
      }
      if (obj.previousSibling.data.substr(0, 6) === 'Poison') $(obj).val('10').prop('selected', true)
      else  $(obj).val('20').prop('selected', true)
  }).change(function() {
      $(this.previousSibling).replaceWith(this.previousSibling.data.split(' ')[0] + ' ' + $(this).val().toString());
  });

  $('.restartButton').on('click', function() {
      for (var spot of cardSpots) {
          spot.cards.splice(0, spot.cards.length);
      }
      cardsInGame.splice(0, cardsInGame.length);
      $('#cardLayer').empty();
      yourLibraryList = yourLibraryListHold.slice();
      oppLibraryList = oppLibraryListHold.slice();
      numCards = 0;
      placeNextCardFromLibrary(true);
      placeNextCardFromLibrary(false);
      oppLibraryList.pop();
      yourLibraryList.pop();
      $('.menuBarSelect').each(function(index, obj) {
          if (obj.previousSibling.data.substr(0, 6) === 'Poison') $(obj).val('10').prop('selected', true)
          else  $(obj).val('20').prop('selected', true)
          $(obj.previousSibling).replaceWith(this.previousSibling.data.split(' ')[0] + ' ' + $(this).val().toString());
      })
  });

  //$(".library").mousedown(libraryMouseDown);

  //$(".card").mousedown(cardMouseDown);

  $(window).mouseup(function() {
      if (lastPosition !== undefined) {
          var currentSpot, dist;
          if (mouseHasMoved === false) {
              var cardData = cardsInGame[$(lastPosition.card).attr('id')];
              if (cardData.zone.indexOf('Library') !== -1 || cardData.zone.indexOf('Graveyard') !== -1 || cardData.zone.indexOf('Exile') !== -1) {
                  keyBindings['A'](lastPosition.card);
              }
              else if (cardData.zone.indexOf('Hand') !== -1) {
                  keyBindings['B'](lastPosition.card);
              }
              else if (cardData.zone.indexOf('battlefield') !== -1) {
                  keyBindings['T'](lastPosition.card);
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
                  yourLibraryList.pop();
              }
              else {
                  oppLibraryList.pop();
              }
          }

          addCardToSpot(lastPosition.card, cardSpots.indexOf(currentSpot));



          lastPosition = undefined;
      }
  });

  $(window).mousemove(function(e) {
      if (lastPosition !== undefined) {
          if (cardsInGame[$(lastPosition.card).attr('id')].zone !== undefined) {
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
              placeNextCardFromLibrary(cardsInGame[$(lastPosition.card).attr('id')].isYourCard);
          }
      }
      mouseHasMoved = true;
      return false;
  });

  var keyBindings = {
      T: function(card) { //tap
          if ($(card).hasClass('library')) return;
          var cardData = cardsInGame[$(card).attr('id')];
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
          var destinationIndex = oppGraveyardIndex;
          if (cardsInGame[$(card).attr('id')].isYourCard === true) {
              destinationIndex = yourGraveyardIndex;
          }
          addCardToSpot(card, destinationIndex);
      },
      Y: function(card) { //top of library
          var destinationIndex = oppLibraryIndex;
          if (cardsInGame[$(card).attr('id')].isYourCard === true) {
              destinationIndex = yourLibraryIndex;
          }
          addCardToSpot(card, destinationIndex);
      },
      X: function(card) { //exile
          var destinationIndex = oppExileIndex;
          if (cardsInGame[$(card).attr('id')].isYourCard === true) {
              destinationIndex = yourExileIndex;
          }
          addCardToSpot(card, destinationIndex);
      },
      B: function(card) { //battlefield
          var cardData = cardsInGame[$(card).attr('id')];
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
          var destinationRange = oppHandRange;
          if (cardsInGame[$(card).attr('id')].isYourCard === true) {
              destinationRange = yourHandRange;
          }
          var destinationIndex;
          for (var i = destinationRange.min; i <= destinationRange.max; i++) {
              if (cardSpots[i].cards.length === 0) {
                  destinationIndex = i;
                  break;
              }
          }
          addCardToSpot(card, destinationIndex);
      }
  };

  $(window).keydown(function(e) {
     var c = String.fromCharCode(e.which);
     var hoverCard = $('.hovered');
     if (hoverCard !== undefined) {
        // hoverCard.css('z-index', zIndexCount++ + 1);
         keyBindings[c](hoverCard[0]);
    }
  });

})()
