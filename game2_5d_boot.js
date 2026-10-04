/*
 * 2.5D boot guard.
 * The RPG declares PLAYER before initializing it, so the visual layer's
 * old startup gate could wait forever on a fresh session. Initialize the
 * normal RPG state when needed; the existing 2.5D layer then takes over.
 */
(function () {
  "use strict";

  function ensure2_5dCanStart() {
    if (document.getElementById("world25d")) return;
    if (typeof WORLD === "undefined") {
      setTimeout(ensure2_5dCanStart, 50);
      return;
    }
    if (typeof PLAYER === "undefined" && typeof resetState === "function") {
      resetState();
    }
    if (typeof PLAYER === "undefined") {
      setTimeout(ensure2_5dCanStart, 50);
    }
  }

  ensure2_5dCanStart();
})();
