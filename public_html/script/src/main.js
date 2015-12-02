(function() {
  $("#battlefield").height(window.innerHeight - $(".playerSection").outerHeight(true) * 2 - 16);
  $("#cardLayer").append("<div class='card'>");

  var lastEvent;

  $(".card").mousedown(function(e) {
      lastEvent = e;
  });

  $(window).mouseup(function() {
     lastEvent = undefined;
  });

  $(window).mousemove(function(e) {
      if (lastEvent !== undefined) {
          var offset = $(lastEvent.target).offset();
          deltaY = e.clientY - lastEvent.clientY;
          deltaX = e.clientX - lastEvent.clientX;
          $(lastEvent.target).offset({
              top: offset.top + deltaY,
              left: offset.left + deltaX
          });
          lastEvent = e;
      }
  });

})()
