import { Game } from "./game";
import { SettingsManager } from "./settings";
import AudioManager from "./audioManager";

const settingsManager = new SettingsManager();
const audioManager = new AudioManager();
const settings = settingsManager.getSettings();
let gameInstance: Game;
export let gameRect: DOMRect;
export let gameOffsetWidth: number;
export let gameOffsetHeight: number;
// this is way too silly pls fix future me
export let realFPS: number;

const gameWindow = document.getElementById("game")!;
const fullscreenButton = document.getElementById(
  "fullscreenButton",
) as HTMLButtonElement;

const customAlertOverlay = document.getElementById(
  "customAlertOverlay",
) as HTMLDivElement;
const customAlertText = document.getElementById(
  "customAlertText",
) as HTMLParagraphElement;
const customAlertCloseButton = document.getElementById(
  "customAlertClose",
) as HTMLButtonElement;

function showCustomAlert(text: string) {
  customAlertText.textContent = text;
  customAlertOverlay.style.display = "flex";
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
}

function hideCustomAlert() {
  customAlertOverlay.style.display = "none";
  customAlertText.textContent = "";
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
}

customAlertCloseButton.addEventListener("click", hideCustomAlert);

window.addEventListener("load", async function () {
  gameOffsetWidth = gameWindow.offsetWidth;
  gameOffsetHeight = gameWindow.offsetHeight;

  await audioManager.loadAll();

  if (!settings.music) {
    audioManager.setVolume("music", 0);
  }

  const infoIcons = document.querySelectorAll(".info-label .label-info-icon");

  infoIcons.forEach((icon) => {
    const infoIcon = icon as HTMLImageElement;
    if (infoIcon.title) {
      infoIcon.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        showCustomAlert(infoIcon.title);
      });
    }
  });

  gameInstance = new Game(audioManager, settingsManager);
});

const times: number[] = [];

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    if (gameWindow.requestFullscreen) {
      gameWindow.requestFullscreen();
    } else if ((gameWindow as any).mozRequestFullScreen) {
      (gameWindow as any).mozRequestFullScreen();
    } else if ((gameWindow as any).webkitRequestFullscreen) {
      (gameWindow as any).webkitRequestFullscreen();
    } else if ((gameWindow as any).msRequestFullscreen) {
      (gameWindow as any).msRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if ((document as any).mozCancelFullScreen) {
      (document as any).mozCancelFullScreen();
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    } else if ((document as any).msExitFullscreen) {
      (document as any).msExitFullscreen();
    }
  }
}

function updateFullscreenButton() {
  if (document.fullscreenElement) {
    fullscreenButton.textContent = "Exit Fullscreen";
  } else {
    fullscreenButton.textContent = "Fullscreen";
  }
}

fullscreenButton?.addEventListener("click", toggleFullscreen);

document.addEventListener("fullscreenchange", updateFullscreenButton);
document.addEventListener("webkitfullscreenchange", updateFullscreenButton);
document.addEventListener("mozfullscreenchange", updateFullscreenButton);
document.addEventListener("MSFullscreenChange", updateFullscreenButton);

document
  .getElementById("startButton")
  ?.addEventListener("click", () => start());


function showPauseMenu() {
  gameInstance.pause();
  document.getElementById('pauseMenu')!.style.display = 'flex';
}
function hidePauseMenu() {
  gameInstance.resume();
  document.getElementById('pauseMenu')!.style.display = 'none';
}

document.getElementById('pauseButton')?.addEventListener('click', showPauseMenu);
document.getElementById('resumeButton')?.addEventListener('click', hidePauseMenu);

// Listen for Escape key to open/close pause menu
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const pauseMenu = document.getElementById('pauseMenu');
    if (pauseMenu?.style.display === 'flex') {
      hidePauseMenu();
    } else {
      showPauseMenu();
    }
  }
});

async function start() {
  (
    document.getElementById("startButton") as HTMLButtonElement
  ).style.visibility = "hidden";
  document.getElementById("pauseButton")!.style.display = "block";

  const played = await audioManager.play("music");
  if (!played) {
    console.warn("Music did not start");
  }

  gameInstance.init();
}
