(function() {
  $("#battlefield").height(window.innerHeight - $(".playerSection").outerHeight(true) * 2 - 16);
  $("#cardLayer").append("<div class='card'>");

  var lastPosition;
  var cardSpacing = {x: 10, y: 5};
  var cardSize = {width: 84, height: 115};

  var cardSpots = [];
  var numCards = 2;
  var mouseHasMoved = false;

  var yourLibrary = ["vryn%20wingmare", "mountain", "counterspell", "electrolyze"];
  var oppLibrary = ["island", "mountain", "counterspell", "electrolyze"];

  var cardImageLinkBase = "http://gatherer.wizards.com/Handlers/Image.ashx?type=card&name=";

  $(".zone").each(function(index, zone) {
      var wid = $(zone).width(), hgt = $(zone).height();
      var initialX = cardSpacing.x, initialY = cardSpacing.y;
      if (2 * cardSpacing.x + cardSize.width > wid) {
          initialX = 0;//(wid - cardSize.width) / 2;
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
              cardSpots.push({x: x + $(zone).offset().left, y: y + $(zone).offset().top, cards: []});
              if ($(zone).attr('id') === "yourLibrary" || $(zone).attr('id') === "oppLibrary") {
                  $("#cardLayer").append($("<div class='card library'>").css({
                      height: 115,
                      width: 84,
                      left: x + $(zone).offset().left,
                      top: y + $(zone).offset().top
                  }));
              }
          }
          else {
              for (var y = initialY; y + initialY / 2 + cardSize.height <= hgt / 2; y += (cardSpacing.y + cardSize.height)) {
                  cardSpots.push({x: x + $(zone).offset().left, y: y + $(zone).offset().top - 8, cards: []});
                  cardSpots.push({x: x + $(zone).offset().left, y: hgt - y - cardSize.height + $(zone).offset().top - 8, cards: []});
              }
          }
      }
  })

  var cardMouseDown = function(e) {
    if ($(e.target).hasClass('card')) {
        lastPosition = {card: e.target, x: e.clientX, y: e.clientY};
    }
    $(e.target).css('z-index', numCards + 1);
    mouseHasMoved = false;
};

  var libraryMouseDown = function(e) {
      if ($(e.target).hasClass("library")) {
          $("#cardLayer").append($("<div class='card library'>").css({
              height: 115,
              width: 84,
              left: $(e.target).offset().left - 7,
              top: $(e.target).offset().top - 7
          })).mousedown(libraryMouseDown).mousedown(cardMouseDown);
          numCards++
      }
  };

  $(".library").mousedown(libraryMouseDown);

  $(".card").mousedown(cardMouseDown);

  $(window).mouseup(function() {
      if (lastPosition !== undefined) {
          var currentSpot, dist;
          if ($(lastPosition.card).hasClass('library') && mouseHasMoved === false) {
              var minX = lastPosition.x;
              for (var spot of cardSpots) {
                  var delta = spot.y - $(lastPosition.card).offset().top, cardX = $(lastPosition.card).offset().left;
                  if (-10 < delta && delta < 10 && spot.cards.length === 0 && spot.x <= minX) {
                      currentSpot = spot;
                      minX = spot.x;
                      dist = (spot.x - cardX) * (spot.x - cardX);
                  }
              }
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

          if ($(lastPosition.card).hasClass('library'))
              $(lastPosition.card).removeClass('library').css('background-image', 'url('+ cardImageLinkBase + yourLibrary.pop() + ')');

          cardSpots[cardSpots.indexOf(currentSpot)].cards.push(lastPosition.card);

          $(lastPosition.card).animate({
              top: currentSpot.y,
              left: currentSpot.x
          }, dist / 4000, "swing");



          lastPosition = undefined;
      }
  });

  $(window).mousemove(function(e) {
      if (lastPosition !== undefined) {
        //  if ($(lastPosition.card).hasClass('library'))
        //      $(lastPosition.card).removeClass('library');
          var offset = $(lastPosition.card).offset();
          deltaY = e.clientY - lastPosition.y;
          deltaX = e.clientX - lastPosition.x;
          $(lastPosition.card).offset({
              top: offset.top + deltaY,
              left: offset.left + deltaX
          });
          lastPosition.x = e.clientX;
          lastPosition.y = e.clientY;
      }
      mouseHasMoved = true;
      return false;
  });

})()
