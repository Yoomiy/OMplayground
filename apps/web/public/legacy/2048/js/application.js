// Wait till the browser is ready to render the game (avoids glitches)
window.requestAnimationFrame(function () {
  window.gameManagerInstance = new GameManager(4, KeyboardInputManager, HTMLActuator, LocalStorageManager);
});

window.addEventListener("playground-restore", function (event) {
  if (window.gameManagerInstance && event.detail) {
    window.gameManagerInstance.storageManager.setGameState(event.detail);
    window.gameManagerInstance.setup();
  }
});
