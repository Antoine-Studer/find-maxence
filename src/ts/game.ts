import AudioManager from "./audioManager";
import { Settings, SettingsManager } from "./settings";

interface CharacterImages {
  [key: string]: HTMLImageElement;
}

interface CharacterInstance {
  img: HTMLImageElement;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CharacterConfig {
  name: string;
  width: number;
  height: number;
}

interface WorkerIcon {
  x: number;
  y: number;
  dx: number;
  dy: number;
  width: number;
  height: number;
}

class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private characters: CharacterInstance[] = [];
  private worker: Worker;
  private characterImages: CharacterImages = {};
  private audioManager: AudioManager;
  private settings: Settings;
  private animationFrameId: number = 0;
  private points: number = 0;
  private isWindowFocused: boolean = true;
  private isGameRunning: boolean = false;

  private timer: number = 60;
  private isPaused: boolean = false;
  private isGameOver: boolean = false;
  private additionalTime: number = 5;
  private loseTime: number = 10;
  private lastTimestamp: number = 0;
  private isInvincible: boolean = false; // Add this line
  private invincibilityDuration: number = 500; // 0.5 seconds, adjust as needed
  private handleSubmitScoreBound: EventListener | null = null;

  private speed: number = 100;
  private minIcons: number = 5;
  private maxIcons: number = 5;

  private bonusText: { x: number; y: number; value: string; opacity: number; start: number } | null = null;

  constructor(audioManager: AudioManager, settingsManager: SettingsManager) {
    this.canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;
    this.audioManager = audioManager;
    this.settings = settingsManager.getSettings();
    console.log("Settings:", this.settings);
    this.worker = new Worker(
      new URL("./animation-worker.ts?worker&url", import.meta.url),
      { type: "module" },
    );

    this.loadCharacterImages();
    this.setupEventListeners();
  }
  private updateTimer(timestamp: number) {
    if (!this.lastTimestamp) {
      this.lastTimestamp = timestamp;
      return;
    }
    
    if (!this.isPaused && this.isGameRunning) {
      const deltaTime = (timestamp - this.lastTimestamp) / 1000; // Convert to seconds
      this.timer -= deltaTime;
      
      // Update timer display here
      const timerElement = document.getElementById('timeRemaining');
      if (timerElement) {
        timerElement.textContent = this.timer.toPrecision(2).toString();
        if (this.timer <= 0) {
          timerElement.textContent = "0.00";
        }
      }
      
      if (this.timer <= 0) {
        this.gameOver();
      }
    }
    
    this.lastTimestamp = timestamp;
  }

  private gameOver() {
    cancelAnimationFrame(this.animationFrameId);
    if (this.worker) {
      this.worker.terminate();
    }
    this.isGameRunning = false;
    this.isGameOver = true;
    console.log("Game Over - Time's up!");
    
    // Display game over message
    const gameOverElement = document.getElementById('gameOver');
    if (gameOverElement) {
      gameOverElement.style.display = 'block';
    }
  }

  private loadCharacterImages() {
    ["maxence", "timothee", "valentin", "lucas", "antoine", "martin", "garance"].forEach((name) => {
      const img = new Image();
      img.src = `img/character/${name}.png`;
      this.characterImages[name] = img;
    });
  }

  private setupEventListeners() {
    if (!this.worker.onmessage) {
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
    }
    
    // stupid way of avoiding duplicate event listeners
    this.canvas.removeEventListener("click", this.handleCanvasClick.bind(this));
    this.canvas.addEventListener("click", this.handleCanvasClick.bind(this));

    window.removeEventListener("focus", this.handleWindowFocus.bind(this));
    window.removeEventListener("blur", this.handleWindowBlur.bind(this));

    window.addEventListener("focus", this.handleWindowFocus.bind(this));
    window.addEventListener("blur", this.handleWindowBlur.bind(this));

    const restartButtons = document.getElementsByClassName("restart-button");
    for (let i = 0; i < restartButtons.length; i++) {
      const restartButton = restartButtons[i] as HTMLButtonElement;
      restartButton.addEventListener("click", () => {
        document.getElementById("saveScore")!.style.display = "block";
        document.getElementById('pauseMenu')!.style.display = "none";
        this.points = 0;
        this.timer = 60;
        document.getElementById("girafe")!.style.display = "none";
        document.getElementById("girafeNumber")!.style.display = "none";
        for (let i = 0; i < 5; i++) {
          const beerElement = document.getElementById(`biere-${i}`);
          if (beerElement) {
            beerElement.style.display = "none";
          }
        }
        this.restartGame();
    });

    // Remove previous submit event listener if it exists
    const submitBtn = document.getElementById('submit');
    if (submitBtn && this.handleSubmitScoreBound) {
      submitBtn.removeEventListener('click', this.handleSubmitScoreBound);
    }
    // Create and add the new event listener
    this.handleSubmitScoreBound = () => {
      const nameInput = document.getElementById('name') as HTMLInputElement | null;
      const name = nameInput ? nameInput.value.trim() : "";
      // Check for empty name
      if (!name) {
        alert("Name is required.");
        return;
      }
      // Check for name length
      if (name.length > 20) {
        alert("Name must be less than 20 characters.");
        return;
      }
      const score = this.points;
      fetch('http://localhost:3000/add-score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: name, score: score }),
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(err => { 
            throw new Error(err.error || `Server error: ${response.statusText}`);
          }).catch(() => { 
            throw new Error(`Server error: ${response.status} ${response.statusText}`);
          });
        }
        return response.json();
      })
      .then(data => {
        console.log('Score submitted successfully:', data);
        const gameOverFormElement = document.getElementById("gameOverForm");
        if (gameOverFormElement) {
          gameOverFormElement.style.display = "none";
        }
        const gameOverElement = document.getElementById("gameOver");
        if (gameOverElement) {
          gameOverElement.style.display = "block";
        }
      })
      .catch(error => {
        // Display error to user
        alert(error.message || 'Error submitting score.');
        console.error('Error submitting score:', error);
      });
    };
    if (submitBtn) {
      submitBtn.addEventListener('click', this.handleSubmitScoreBound);
    }

    document.getElementById("saveScore")?.addEventListener("click", () => {
      document.getElementById("score")!.textContent = `${this.points}`;
    });
    }}

  private handleWorkerMessage(event: MessageEvent) {
    const { type, positions } = event.data;
    if (type === "update") {
      positions.forEach((position: { x: number; y: number }, index: number) => {
        if (this.characters[index]) {
          this.characters[index].x = position.x;
          this.characters[index].y = position.y;
        }
      });
      this.drawCharacters();
    }
  }

  private drawCharacters() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.imageSmoothingEnabled = false;
    this.characters.forEach(({ img, x, y, width, height }) => {
      this.ctx.drawImage(img, x, y, width, height);
    });

    // Affiche le texte bonus si besoin
    if (this.bonusText) {
      const elapsed = performance.now() - this.bonusText.start;
      if (elapsed < 1200) {
        this.ctx.save();
        this.ctx.globalAlpha = 1 - elapsed / 1200;
        this.ctx.font = "bold 32px Arial";
        // Couleur verte pour bonus, rouge pour malus
        if (this.bonusText.value.startsWith('-')) {
          this.ctx.fillStyle = "red";
        } else {
          this.ctx.fillStyle = "green";
        }
        this.ctx.strokeStyle = "#000";
        this.ctx.lineWidth = 3;
        const textX = this.bonusText.x;
        const textY = this.bonusText.y - elapsed / 3;
        this.ctx.strokeText(this.bonusText.value, textX, textY);
        this.ctx.fillText(this.bonusText.value, textX, textY);
        this.ctx.restore();
      } else {
        this.bonusText = null;
      }
    }
  }

  private addCharacter(character: CharacterConfig, workerIcons: WorkerIcon[]) {
    const randomX = Math.random() * (this.canvas.width - character.width);
    const randomY = Math.random() * (this.canvas.height - character.height);
    const randomDx = (Math.random() - 0.5) * this.speed + this.points * 7;
    const randomDy = (Math.random() - 0.5) * this.speed + this.points * 7;
    this.characters.push({
      img: this.characterImages[character.name],
      x: randomX,
      y: randomY,
      width: character.width,
      height: character.height,
    });

    workerIcons.push({
      x: randomX,
      y: randomY,
      dx: randomDx,
      dy: randomDy,
      width: character.width,
      height: character.height,
    });
  }

  public init() {
    this.canvas.width = 960;
    this.canvas.height = 540;
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";

    // Reset game state for new games
    if (this.isGameOver) {
      this.timer = 60; // Reset to starting time
      this.isGameOver = false;
      
      // Hide game over message if it exists
      const gameOverElement = document.getElementById('gameOver');
      if (gameOverElement) {
        gameOverElement.style.display = 'none';
      }
    }

    const availableCharacters: CharacterConfig[] = [
      { name: "maxence", width: 60, height: 77 },
      this.settings.useTimothee && { name: "timothee", width: 60, height: 83 },
      this.settings.useValentin && { name: "valentin", width: 60, height: 83 },
      this.settings.useLucas && { name: "lucas", width: 60, height: 83 },
      this.settings.useAntoine && { name: "antoine", width: 60, height: 83 },
      this.settings.useMartin && { name: "martin", width: 60, height: 83 },
      this.settings.useGarance && { name: "garance", width: 60, height: 83 },
    ].filter(Boolean) as CharacterConfig[];
    const minIcons = this.minIcons + this.points; // Ensure at least one character is added;
    const maxIcons = this.maxIcons + this.points * 2; // Ensure at least one character is added;
    const iconCount =
      Math.floor(Math.random() * (maxIcons - minIcons + 1)) + minIcons;
    const workerIcons: WorkerIcon[] = [];
    this.characters = [];

    this.addCharacter(availableCharacters[0], workerIcons);

    for (let i = 0; i < iconCount; i++) {
      let character = availableCharacters[i % availableCharacters.length];
      if (character.name === "maxence") {
        character = availableCharacters[(i + 1) % availableCharacters.length];
      }
      this.addCharacter(character, workerIcons);
    }

    if (this.settings.shuffleCharacterLayers) {
      this.characters = this.shuffleArray<CharacterInstance>(this.characters);
    }

    this.worker.postMessage({
      type: "init",
      iconData: workerIcons,
      gameWidth: this.canvas.width,
      gameHeight: this.canvas.height,
      movementThreshold: this.settings.movementThreshold,
      useInterpolation: this.settings.useInterpolation,
    });

    this.isGameRunning = true;
    this.animationFrameId = requestAnimationFrame(this.animateAll);
  }

  private updateScore() {
    console.log("Points:", this.points);
    console.log("Time bonus:", this.additionalTime);
    const numberGirafe = Math.floor(this.points / 5);
    const numberBiere = this.points % 5;

    for (let i = 0; i < numberBiere; i++) {
      const beerElement = document.getElementById(`biere-${i}`);
      if (beerElement) {
        beerElement.style.display = "block";
      }
    }
    if (this.points % 5 === 0 && this.points > 0) {
      // Animation des 5 bières
      for (let i = 0; i < 5; i++) {
        document.getElementById(`biere-${i}`)!.style.display = "none";
      }
      document.getElementById("girafe")!.style.display = "block";

    }

    if (numberGirafe < 1) {
      document.getElementById("girafeNumber")!.style.display = "none";
    }
    else if (numberGirafe < 2) {
      document.getElementById("girafeNumber")!.style.display = "block";
    }
    document.getElementById('girafeNumber')!.textContent = numberGirafe.toString();

  }


  private handleCanvasClick(event: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    const scaleRatio = Math.min(
      rect.width / canvasWidth,
      rect.height / canvasHeight,
    );
    const scaledWidth = canvasWidth * scaleRatio;
    const scaledHeight = canvasHeight * scaleRatio;
    const offsetX = (rect.width - scaledWidth) / 2;
    const offsetY = (rect.height - scaledHeight) / 2;

    const clickX = (event.clientX - rect.left - offsetX) / scaleRatio;
    const clickY = (event.clientY - rect.top - offsetY) / scaleRatio;

    // First check if Maxence was clicked
    for (const character of this.characters) {
      const { x, y, width, height, img } = character;
      if (
        clickX >= x &&
        clickX <= x + width &&
        clickY >= y &&
        clickY <= y + height &&
        img === this.characterImages.maxence &&
        this.isGameRunning
      ) {
        // Found Maxence! Add time and handle success
        this.bonusText = {
          x: x + width / 2,
          y: y,
          value: `+${this.additionalTime}`,
          opacity: 1,
          start: performance.now(),
        };

        if (this.timer + this.additionalTime > 60) {
          this.timer = 60; // Cap the timer at 60 seconds
        }
        else {

          this.timer += this.additionalTime; // Add time
        }
        this.isPaused = true; // Pause the timer
        
        cancelAnimationFrame(this.animationFrameId);
        if (this.worker) {
          this.worker.terminate();
        }
        this.isGameRunning = false;
        
        if (this.settings.SFX) {
          this.audioManager.playRandomCaughtSound();
        }
        this.points++;
        this.updateScore();
        
        this.characters = this.characters.filter(
          (character) => character.img === this.characterImages.maxence,
        );
        this.drawCharacters();

        setTimeout(() => this.restartGame(), 3000);
        return; // Exit early - we found Maxence
      }
    }
    
    if (this.isInvincible) {
      return;
    }

    for (const character of this.characters) {
      const { x, y, width, height, img } = character;
      if (
        clickX >= x &&
        clickX <= x + width &&
        clickY >= y &&
        clickY <= y + height &&
        img !== this.characterImages.maxence &&
        this.isGameRunning // Ensure game is running for penalty
      ) {

        this.bonusText = {
          x: x + width / 2,
          y: y,
          value: `-${this.loseTime}`,
          opacity: 1,
          start: performance.now(),
        };
        // Wrong character clicked, lose time
        this.timer -= this.loseTime;
        console.log("Time penalty:", this.loseTime);
        
        if (this.timer <= 0) {
          this.timer = 0;
          this.gameOver();
        }
        // Activate invincibility
        this.isInvincible = true;
        setTimeout(() => {
          this.isInvincible = false;
        }, this.invincibilityDuration);
        
        return; // Exit after handling the wrong click once
      }
    }
  }

  private restartGame() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.isPaused = false;
    this.lastTimestamp = 0;

    this.worker = new Worker(
      new URL("./animation-worker.ts?worker&url", import.meta.url),
      { type: "module" },
    );

    this.setupEventListeners();
    this.init();
  }

  private handleWindowFocus() {
    this.isWindowFocused = true;
    if (this.isGameRunning) {
      this.canvas.style.display = "flex";
      document.getElementById("unfocusedNotice")!.style.display = "none";
      this.worker.postMessage({ type: "pause", paused: false });

      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = requestAnimationFrame(this.animateAll);
    }
  }

  private handleWindowBlur() {
    this.isWindowFocused = false;
    if (this.isGameRunning) {
      this.canvas.style.display = "none";
      document.getElementById("unfocusedNotice")!.style.display = "block";
      this.worker.postMessage({ type: "pause", paused: true });
    }
  }
  public pause() {
    this.isGameRunning = false;
    // Save the time when paused
    this.pauseTimestamp = performance.now();
  }
  public resume() {
    this.isGameRunning = true;
    // Adjust lastTimestamp so timer doesn't jump
    if (this.pauseTimestamp) {
      const now = performance.now();
      this.lastTimestamp += (now - this.pauseTimestamp);
      this.pauseTimestamp = undefined;
    }
    this.animateAll(performance.now());
  }
  private pauseTimestamp?: number;

  private shuffleArray<T>(array: T[]): T[] {
    // Fisher-Yates shuffle
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
  public animateAll = (timestamp: number) => {
    if (this.isWindowFocused && this.isGameRunning) {
      this.updateTimer(timestamp);
      this.worker.postMessage({ type: "animate", time: performance.now() });
      this.animationFrameId = requestAnimationFrame(this.animateAll);
    }
  };
}

export { Game };
