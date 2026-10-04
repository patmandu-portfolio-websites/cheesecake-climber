(() => {
  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const overlay = document.querySelector("#overlay");
  const scoreLabel = document.querySelector("#score");
  const coinLabel = document.querySelector("#coins");
  const bestLabel = document.querySelector("#best");
  const livesLabel = document.querySelector("#lives");
  const inventoryLabel = document.querySelector("#inventory");
  const title = document.querySelector("#title");
  const message = document.querySelector("#message");
  const playButton = document.querySelector("#play");
  const hint = document.querySelector("#hint");

  const fillings = [
    { name: "Strawberry ricotta", top: "#fff0d9", side: "#e8a66e", stripe: "#ec8290", fruit: "#dc5970" },
    { name: "Honey mascarpone", top: "#fff1b9", side: "#e5ad52", stripe: "#d88b36", fruit: "#f3c64f" },
    { name: "Blueberry cream", top: "#f3eaff", side: "#aa8ec7", stripe: "#9380d1", fruit: "#6654ac" },
    { name: "Pistachio cheese", top: "#edffd5", side: "#96b878", stripe: "#76a657", fruit: "#6d9855" },
    { name: "Cheddar swirl", top: "#fff0cb", side: "#e99a4b", stripe: "#efa92f", fruit: "#e58628" }
  ];
  const gravity = 1350;
  const jumpSpeed = 620;
  const playerScreenRatio = .48;
  const platformHeight = 76;
  const platformWidth = 126;
  const objectiveLeadTime = 1.8;
  const giftRibbonDuration = 1.8;
  const initialGiftInterval = 5;
  const laterGiftInterval = 10;
  const finalGiftInterval = 15;
  const animals = ["🐰", "🐱", "🐥", "🐼", "🦊", "🐸"];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let player = null;
  let support = null;
  let tower = [];
  let objective = null;
  let coinsOnScreen = [];
  let score = 0;
  let coinCount = 0;
  let livesCount = 3;
  let inventory = [];
  let best = Number(localStorage.getItem("cheesecake-climber-best") || 0);
  let bestToyCount = Number(localStorage.getItem("cheesecake-climber-best-toys") || 0);
  let bestCoinCount = Number(localStorage.getItem("cheesecake-climber-best-coins") || 0);
  let cameraY = 0;
  let state = "ready";
  let lastTime = 0;
  let particles = [];
  let giftRibbonTime = 0;
  let giftsCollected = 0;
  let nextGiftScore = initialGiftInterval;

  bestLabel.textContent = best;
  renderHud();

  function resize() {
    const oldWidth = width;
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (oldWidth && player && state !== "ready") {
      const ratio = width / oldWidth;
      player.x *= ratio;
      tower.forEach((slice) => { slice.x *= ratio; });
      if (objective) objective.x = player.x - objective.width / 2 + objective.speed * objectiveLeadTime;
    }
    if (state === "ready") resetGame();
  }

  function persistBestStats() {
    if (inventory.length > bestToyCount) {
      bestToyCount = inventory.length;
      localStorage.setItem("cheesecake-climber-best-toys", String(bestToyCount));
    }
    if (coinCount > bestCoinCount) {
      bestCoinCount = coinCount;
      localStorage.setItem("cheesecake-climber-best-coins", String(bestCoinCount));
    }
  }

  function resetGame() {
    score = 0;
    coinCount = 0;
    livesCount = 3;
    inventory = [];
    localStorage.setItem("cheesecake-climber-toys", JSON.stringify(inventory));
    cameraY = 0;
    particles = [];
    giftRibbonTime = 0;
    giftsCollected = 0;
    nextGiftScore = initialGiftInterval;
    tower = [];
    coinsOnScreen = [];
    objective = null;
    respawnTimer = 0;
    const baseY = Math.max(150, height * (playerScreenRatio + .08));
    support = {
      x: width / 2 - platformWidth / 2,
      y: baseY,
      width: platformWidth,
      height: platformHeight,
      filling: fillings[1],
      index: 0,
      kind: "floor",
      seed: Math.random() * 10
    };
    tower.push(support);
    player = {
      x: width / 2,
      y: baseY - 18,
      vy: 0,
      radius: 18,
      onGround: true,
      facing: 1
    };
    renderHud();
  }

  function renderHud() {
    scoreLabel.textContent = score;
    coinLabel.textContent = coinCount;
    livesLabel.textContent = "❤️".repeat(livesCount) + "🖤".repeat(3 - livesCount);
    inventoryLabel.textContent = inventory.length
      ? `🎁 TOYS · ${inventory.join(" ")}`
      : "🎁 TOYS · empty";
  }

  function isMobileDevice() {
    return window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 768;
  }

  function speedFactor() {
    const progression = 1 + Math.min(Math.floor(score / 5), 20) * .07;
    return progression * (isMobileDevice() ? 1.14 : 1);
  }

  function jumpSpeedFactor() {
    return speedFactor();
  }

  function createObjective() {
    const gift = score >= nextGiftScore;
    const speed = (width / 2 + platformWidth + 24) / 2.4 * speedFactor();
    objective = {
      x: width >= 900 ? width - platformWidth - 300 : player.x - platformWidth / 2 + speed * objectiveLeadTime,
      y: support.y - platformHeight,
      width: platformWidth,
      height: platformHeight,
      kind: gift ? "gift" : "cheese",
      filling: fillings[(score + 1) % fillings.length],
      animal: animals[giftsCollected % animals.length],
                speed,
      opening: false,
      openTime: 0,
      collected: false,
      seed: Math.random() * 10
    };
  }

  function startGame() {
    resetGame();
    state = "playing";
    overlay.classList.add("hidden");
    hint.textContent = "Tap / ↑ / SPACE to jump over the sliding cheese!";
    createObjective();
    lastTime = performance.now();
  }

  function endGame() {
    if (state !== "playing") return;
    state = "over";
    persistBestStats();
    inventory = [];
    localStorage.setItem("cheesecake-climber-toys", JSON.stringify(inventory));
    renderHud();
    if (score > best) {
      best = score;
      localStorage.setItem("cheesecake-climber-best", String(best));
      bestLabel.textContent = best;
    }
    title.innerHTML = livesCount ? "Out of lives!<br>One more?" : "Game over!<br>One more?";
    message.textContent = `Pip made ${score} successful ${score === 1 ? "hop" : "hops"}, collected ${coinCount} coins, and found ${inventory.length} toy${inventory.length === 1 ? "" : "s"}.`;
    playButton.textContent = "Hop again";
    overlay.classList.remove("hidden");
    hint.textContent = "Press ↻ or hop again to climb once more";
  }

  function jump() {
    if (state !== "playing" || !player.onGround || !objective) return;
    player.onGround = false;
    player.vy = -jumpSpeed * jumpSpeedFactor();
    coinsOnScreen.push({
      x: player.x,
      y: player.y - 104,
      radius: 9,
      life: 2.4
    });
    spawnCrumbs(player.x, player.y + 14, 5);
  }

  function spawnCrumbs(x, y, count) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - .5) * 120,
        vy: -Math.random() * 120,
        life: .45,
        size: 3 + Math.random() * 3
      });
    }
  }

  function loseLife() {
    if (state !== "playing") return;
    livesCount -= 1;
    renderHud();
    if (livesCount <= 0) {
      endGame();
      return;
    }
    objective = null;
    player.x = width / 2;
    player.y = support.y - player.radius;
    player.vy = 0;
    player.onGround = true;
    cameraY = Math.min(cameraY, player.y - height * playerScreenRatio);
    respawnTimer = .75;
    hint.textContent = `${livesCount} ${livesCount === 1 ? "life" : "lives"} left · jump onto the next cheese!`;
  }

  function landOnObjective() {
    support = objective;
    tower.push(support);
    player.y = support.y - player.radius;
    player.vy = 0;
    player.onGround = true;
    score += 1;
    if (score > best) {
      best = score;
      localStorage.setItem("cheesecake-climber-best", String(best));
      bestLabel.textContent = best;
    }
    spawnCrumbs(player.x, player.y + player.radius, 9);
    if (support.kind === "gift") {
      support.opening = true;
      support.openTime = 0;
      giftRibbonTime = giftRibbonDuration;
    }
    renderHud();
    objective = null;
  }

  let respawnTimer = 0;

  function update(dt) {
    if (state !== "playing") return;
    giftRibbonTime = Math.max(0, giftRibbonTime - dt);
    respawnTimer = Math.max(0, respawnTimer - dt);
    if (!player.onGround) {
      const previousBottom = player.y + player.radius;
      player.vy += gravity * jumpSpeedFactor() * dt;
      player.y += player.vy * dt;
      const playerBottom = player.y + player.radius;

      if (objective) {
        objective.x -= objective.speed * dt;
        const overlapsX = player.x + player.radius * .68 > objective.x
          && player.x - player.radius * .68 < objective.x + objective.width;
        const landedOnTop = player.vy > 0 && overlapsX
          && previousBottom <= objective.y + 4
          && playerBottom >= objective.y;
        if (landedOnTop) {
          landOnObjective();
        } else {
          const nearestX = Math.max(objective.x, Math.min(player.x, objective.x + objective.width));
          const nearestY = Math.max(objective.y, Math.min(player.y, objective.y + objective.height));
          const dx = player.x - nearestX;
          const dy = player.y - nearestY;
          if (dx * dx + dy * dy < player.radius * player.radius) {
            loseLife();
            return;
          }
          if (objective.x + objective.width < 0) {
            loseLife();
            return;
          }
        }
      }

      const supportOverlap = player.x + player.radius * .68 > support.x
        && player.x - player.radius * .68 < support.x + support.width;
      if (!player.onGround && player.vy > 0 && supportOverlap
        && previousBottom <= support.y + 4 && playerBottom >= support.y) {
        player.y = support.y - player.radius;
        player.vy = 0;
        player.onGround = true;
      }
    }

    if (objective && player.onGround && !respawnTimer) {
      objective.x -= objective.speed * dt;
      const nearestX = Math.max(objective.x, Math.min(player.x, objective.x + objective.width));
      const nearestY = Math.max(objective.y, Math.min(player.y, objective.y + objective.height));
      const dx = player.x - nearestX;
      const dy = player.y - nearestY;
      if (dx * dx + dy * dy < player.radius * player.radius || objective.x + objective.width < 0) {
        loseLife();
        return;
      }
    }

    coinsOnScreen = coinsOnScreen.filter((coin) => coin.life > 0);
    for (const coin of coinsOnScreen) {
      coin.life -= dt;
      const dx = player.x - coin.x;
      const dy = player.y - coin.y;
      if (dx * dx + dy * dy < (player.radius + coin.radius) ** 2) {
        coin.life = 0;
        coinCount += 1;
        persistBestStats();
        renderHud();
        spawnCrumbs(coin.x, coin.y, 7);
      }
    }

    if (support.opening && !support.collected) {
      support.openTime += dt;
      if (support.openTime >= .7) {
        const openedGift = support;
        const previousSupport = tower[tower.length - 2];
        openedGift.collected = true;
        giftsCollected += 1;
        const giftInterval = giftsCollected < 3
          ? initialGiftInterval
          : giftsCollected < 6
            ? laterGiftInterval
            : finalGiftInterval;
        nextGiftScore = score + giftInterval;
        support = previousSupport;
        tower = tower.filter((platform) => platform !== openedGift);
        if (player.onGround) {
          player.onGround = false;
          player.vy = 0;
        }
        if (objective) objective.y = support.y - platformHeight;
        inventory.push(openedGift.animal);
        persistBestStats();
        localStorage.setItem("cheesecake-climber-toys", JSON.stringify(inventory));
        renderHud();
        hint.textContent = `${openedGift.animal} toy collected! Keep hopping for more gifts!`;
      }
    }

    if (player.y - cameraY < height * playerScreenRatio) {
      cameraY = player.y - height * playerScreenRatio;
    }
    if (respawnTimer === 0 && !objective && giftRibbonTime === 0) createObjective();

    particles = particles.filter((particle) => particle.life > 0);
    particles.forEach((particle) => {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 300 * dt;
    });
    if (player.y - cameraY > height + 90) loseLife();
  }

  function roundRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
  }

  function drawPlatform(platform) {
    const screenY = platform.y - cameraY;
    if (screenY < -2 * (platform.height + 12) || screenY > height + 20) return;
    const x = platform.x;
    const w = platform.width;
    ctx.save();
    ctx.translate(0, screenY);
    ctx.scale(1, 2);
    if (platform.kind === "gift") {
      drawGift(platform, x, 0, platform.height / 2, screenY);
      ctx.restore();
      return;
    }
    const visualHeight = platform.height / 2;
    const wobble = Math.sin(performance.now() / 650 + platform.seed) * 1.2;
    ctx.translate(0, wobble);
    ctx.fillStyle = "rgba(113, 75, 48, .11)";
    ctx.beginPath();
    ctx.ellipse(x + w / 2 + 4, visualHeight + 4, w * .48, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = platform.filling.side;
    roundRect(x, 6, w, visualHeight - 6, 8);
    ctx.fill();
    ctx.fillStyle = platform.filling.stripe;
    roundRect(x + 2, 20, w - 4, 9, 3);
    ctx.fill();

    ctx.fillStyle = platform.filling.top;
    roundRect(x - 2, -8, w + 4, 17, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, .6)";
    ctx.beginPath();
    ctx.ellipse(x + w * .27, -3, w * .13, 2.5, -.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = platform.filling.fruit;
    const dots = platform.index % 2 === 0 ? 3 : 2;
    for (let i = 0; i < dots; i++) {
      const dx = x + 22 + i * ((w - 44) / Math.max(1, dots - 1));
      ctx.beginPath();
      ctx.arc(dx, -5 + (i % 2) * 2, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawGift(gift, x, screenY, visualHeight = gift.height, platformScreenY = screenY) {
    ctx.save();
    ctx.fillStyle = "rgba(113, 75, 48, .13)";
    ctx.beginPath();
    ctx.ellipse(x + gift.width / 2, screenY + visualHeight + 4, gift.width * .47, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#df8450";
    roundRect(x + 8, screenY + 6, gift.width - 16, visualHeight - 6, 7);
    ctx.fill();
    ctx.fillStyle = "#f4c85e";
    ctx.fillRect(x + gift.width / 2 - 7, screenY + 6, 14, visualHeight - 6);
    ctx.fillStyle = "#f3a94e";
    ctx.fillRect(x + 8, screenY + 20, gift.width - 16, 6);
    ctx.fillStyle = "#f6ce69";
    if (gift.opening) {
      const lift = Math.min(gift.openTime / .7, 1) * 25;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(x + gift.width / 2, platformScreenY + 12 - lift * 2);
      ctx.rotate(-Math.min(gift.openTime, .7) * 1.1);
      ctx.fillStyle = "#e99555";
      roundRect(-gift.width / 2 + 5, -24, gift.width - 10, 26, 5);
      ctx.fill();
      ctx.restore();
      if (gift.openTime > .12) {
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalAlpha = Math.min(1, (gift.openTime - .12) / .45);
        ctx.font = "27px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(gift.animal, x + gift.width / 2, platformScreenY + 2 - lift * 2);
        ctx.restore();
      }
    } else {
      ctx.beginPath();
      ctx.ellipse(x + gift.width / 2, screenY + 5, 18, 12, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#fffdf7";
    ctx.font = "bold 9px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(gift.collected ? "COLLECTED!" : "GIFT", x + gift.width / 2, screenY + visualHeight - 3);
    ctx.restore();
  }

  function drawCoin(coin) {
    const x = coin.x;
    const y = coin.y - cameraY;
    const shine = .65 + Math.sin(performance.now() / 110) * .15;
    ctx.save();
    ctx.globalAlpha = Math.min(1, coin.life * 2);
    ctx.fillStyle = "rgba(170, 108, 42, .16)";
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 3, coin.radius + 2, coin.radius + 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(245, 192, 65, ${shine})`;
    ctx.beginPath();
    ctx.arc(x, y, coin.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#df982e";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#fff2b4";
    ctx.beginPath();
    ctx.arc(x - 2, y - 2, 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHamster() {
    const x = player.x;
    const y = player.y - cameraY;
    const bob = player.onGround ? Math.sin(performance.now() / 180) * 1.5 : 0;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(player.facing, 1);
    ctx.fillStyle = "rgba(113, 75, 48, .13)";
    ctx.beginPath();
    ctx.ellipse(0, 19, 16, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#d58a4d";
    ctx.beginPath();
    ctx.ellipse(0, 1, 17, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f2c18e";
    ctx.beginPath();
    ctx.ellipse(1, 6, 11.5, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#c97948";
    ctx.beginPath();
    ctx.arc(-10, -10, 6, 0, Math.PI * 2);
    ctx.arc(9, -10, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4b6a6";
    ctx.beginPath();
    ctx.arc(-10, -10, 3.5, 0, Math.PI * 2);
    ctx.arc(9, -10, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#38291f";
    ctx.beginPath();
    ctx.arc(5, -1, 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#df7776";
    ctx.beginPath();
    ctx.arc(12, 5, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawGiftRibbon() {
    if (giftRibbonTime <= 0) return;
    const elapsed = giftRibbonDuration - giftRibbonTime;
    const unfold = Math.min(elapsed / .22, 1);
    const fade = Math.min((giftRibbonDuration - elapsed) / .3, 1);
    const ribbonWidth = width * unfold;
    const ribbonHeight = 54;
    const ribbonY = height * .43;
    const ribbonX = (width - ribbonWidth) / 2;

    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    ctx.fillStyle = "#c96c3a";
    ctx.fillRect(ribbonX, ribbonY, ribbonWidth, ribbonHeight);
    ctx.fillStyle = "#a95330";
    ctx.beginPath();
    ctx.moveTo(ribbonX, ribbonY);
    ctx.lineTo(ribbonX + Math.min(24, ribbonWidth / 2), ribbonY + ribbonHeight / 2);
    ctx.lineTo(ribbonX, ribbonY + ribbonHeight);
    ctx.moveTo(ribbonX + ribbonWidth, ribbonY);
    ctx.lineTo(ribbonX + ribbonWidth - Math.min(24, ribbonWidth / 2), ribbonY + ribbonHeight / 2);
    ctx.lineTo(ribbonX + ribbonWidth, ribbonY + ribbonHeight);
    ctx.fill();

    if (unfold >= 1) {
      ctx.fillStyle = "#fffdf7";
      ctx.font = "900 22px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("GIFT FOUND!", width / 2, ribbonY + ribbonHeight / 2);
    }
    ctx.restore();
  }

  function drawBackground() {
    ctx.clearRect(0, 0, width, height);
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#fffaf0");
    gradient.addColorStop(1, "#ffe8cb");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Speed strips scroll left, parallax-shifted by camera height
    const now = performance.now() / 1000;
    const pace = state === "playing" ? speedFactor() : .6;
    for (let i = 0; i < 16; i++) {
      const lane = i * 53 + (i % 3) * 17;
      const y = ((lane - cameraY * (.25 + (i % 3) * .12)) % (height + 80) + height + 80) % (height + 80) - 40;
      const length = 70 + (i * 37) % 120;
      const velocity = (50 + (i % 4) * 32) * pace;
      const span = width + length + 60;
      const x = width + 30 - (((now * velocity + i * 131) % span + span) % span);
      ctx.fillStyle = i % 2 ? "rgba(218, 119, 43, .32)" : "rgba(255, 255, 255, .8)";
      roundRect(x, y, length, 5 + (i % 3) * 3, 4);
      ctx.fill();
    }

    const glow = ctx.createRadialGradient(width / 2, height * .65, 15, width / 2, height * .65, width * .7);
    glow.addColorStop(0, "rgba(255, 255, 255, .42)");
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  function draw() {
    drawBackground();
    tower.forEach(drawPlatform);
    if (objective) drawPlatform(objective);
    coinsOnScreen.forEach(drawCoin);
    particles.forEach((particle) => {
      ctx.globalAlpha = Math.max(0, particle.life / .45);
      ctx.fillStyle = "#f5cc68";
      ctx.beginPath();
      ctx.arc(particle.x, particle.y - cameraY, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    drawHamster();

    if (objective && objective.x < width + objective.width) {
      const tx = objective.x + objective.width / 2;
      const ty = objective.y - cameraY - 20;
      ctx.fillStyle = objective.kind === "gift" ? "#ba6d3e" : "#9a704c";
      ctx.font = "bold 12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(objective.kind === "gift" ? "GIFT!" : "JUMP!", tx, ty);
    }
    drawGiftRibbon();
  }

  function frame(time) {
    const dt = Math.min((time - lastTime) / 1000 || 0, .032);
    lastTime = time;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function handleJump() {
    if (state === "ready" || state === "over") startGame();
    jump();
  }

  window.addEventListener("resize", resize);
  window.addEventListener("keydown", (event) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "w", "W"].includes(event.key)) event.preventDefault();
    if (event.repeat) return;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "w", "W"].includes(event.key)) handleJump();
  });
  canvas.addEventListener("pointerdown", (event) => {
    if (event.target !== canvas) return;
    handleJump();
  });
  document.querySelector("#jump").addEventListener("pointerdown", (event) => {
    event.preventDefault();
    handleJump();
  });
  playButton.addEventListener("click", startGame);
  document.querySelector("#restart").addEventListener("click", () => {
    title.innerHTML = "Cheesecake<br>Climber";
    message.textContent = "Jump straight up as the cheese slides in from the right. Land on top, grab coins, and watch out for surprise gifts!";
    playButton.textContent = "Let's hop!";
    state = "ready";
    resetGame();
    overlay.classList.remove("hidden");
  });

  resize();
  requestAnimationFrame(frame);
})();
