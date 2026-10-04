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
  const alternateSideScore = 20;
  const appleScore = 30;
  const appleRadius = 20;
  const knockDuration = 1;
  const awardScore = 50;
  const badgeDuration = 4;
  const maxSpeedScore = 15;
  const squishDuration = .4;
  const squishAmount = .2;
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
  let apples = [];
  let appleTimer = 0;
  let appleTurn = false;
  let pendingApple = null;
  let knock = null;
  let award = null;
  let badge = null;

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
      if (objective) objective.x = player.x - objective.width / 2 - objective.dir * objective.speed * objectiveLeadTime;
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

  function resetStack() {
    const baseY = Math.max(150, height * (playerScreenRatio + .08));
    cameraY = 0;
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
    tower = [support];
    return baseY;
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
    apples = [];
    pendingApple = null;
    appleTimer = 0;
    appleTurn = false;
    knock = null;
    award = null;
    badge = null;
    respawnTimer = 0;
    const baseY = resetStack();
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
    const progression = 1 + Math.floor(Math.min(score, maxSpeedScore) / 5) * .07;
    return progression * (isMobileDevice() ? 1.14 : 1);
  }

  function jumpSpeedFactor() {
    return speedFactor();
  }

  function createObjective() {
    const gift = score >= nextGiftScore && score + 1 !== awardScore;
    const speed = (width / 2 + platformWidth + 24) / 2.4 * speedFactor();
    const dir = score >= alternateSideScore && Math.random() < .5 ? 1 : -1;
    const rightX = width >= 900 ? Math.max(width - platformWidth - 300, player.x + 350) : player.x - platformWidth / 2 + speed * objectiveLeadTime;
    objective = {
      x: dir < 0 ? rightX : 2 * player.x - rightX - platformWidth,
      dir,
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
    const toysFound = inventory.length;
    inventory = [];
    localStorage.setItem("cheesecake-climber-toys", JSON.stringify(inventory));
    renderHud();
    if (score > best) {
      best = score;
      localStorage.setItem("cheesecake-climber-best", String(best));
      bestLabel.textContent = best;
    }
    title.innerHTML = livesCount ? "Out of lives!<br>One more?" : "Game over!<br>One more?";
    message.textContent = `Pip made ${score} successful ${score === 1 ? "hop" : "hops"}, collected ${coinCount} coins, and found ${toysFound} toy${toysFound === 1 ? "" : "s"}.`;
    playButton.textContent = "Hop again";
    overlay.classList.remove("hidden");
    hint.textContent = "Press ↻ or hop again to climb once more";
  }

  function jump() {
    if (state !== "playing" || !player.onGround || (!objective && !apples.length && !pendingApple)) return;
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
    if (state !== "playing" || knock) return;
    livesCount -= 1;
    renderHud();
    recoverFromLostLife();
  }

  function hitPlayer(dir, hazardSpeed) {
    if (state !== "playing" || knock) return;
    livesCount -= 1;
    renderHud();
    knock = { dir, time: 0, vx: dir * Math.max(240, hazardSpeed * .9), spin: dir * 9 };
    player.onGround = false;
    player.vy = -300;
    spawnCrumbs(player.x, player.y, 10);
  }

  function updateKnock(dt) {
    knock.time += dt;
    player.x += knock.vx * dt;
    player.vy += gravity * dt;
    player.y += player.vy * dt;
    if (objective) objective.x += objective.dir * objective.speed * dt;
    apples.forEach((apple) => { apple.x += apple.dir * apple.speed * dt; });
    updateParticles(dt);
    if (knock.time >= knockDuration) recoverFromLostLife();
  }

  function recoverFromLostLife() {
    knock = null;
    apples = [];
    pendingApple = null;
    appleTimer = 0;
    appleTurn = false;
    if (livesCount <= 0) {
      player.hidden = true;
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
    support.squishTime = 0;
    if (score === alternateSideScore) hint.textContent = "Cheesecakes now slide in from both sides!";
    if (score === appleScore) hint.textContent = "Apples take turns with the cheesecakes, watch both sides!";
    if (score >= appleScore && Math.random() < .45) {
      appleTurn = true;
      appleTimer = .6;
    }
    if (support.kind === "gift") {
      support.opening = true;
      support.openTime = 0;
      support.collected = true;
      giftRibbonTime = giftRibbonDuration;
      giftsCollected += 1;
      const giftInterval = giftsCollected < 3
        ? initialGiftInterval
        : giftsCollected < 6
          ? laterGiftInterval
          : finalGiftInterval;
      nextGiftScore = score + giftInterval;
      inventory.push(support.animal);
      persistBestStats();
      localStorage.setItem("cheesecake-climber-toys", JSON.stringify(inventory));
      hint.textContent = `${support.animal} toy collected! Keep hopping for more gifts!`;
    }
    renderHud();
    objective = null;
    if (score === awardScore) startAward();
  }

  function startAward() {
    award = { reset: false };
    badge = { time: 0 };
    player.onGround = false;
    player.vy = -Math.sqrt(2 * gravity * (player.y - cameraY + 200));
    hint.textContent = `${awardScore} hops! The stack starts fresh!`;
  }

  function updateAward(dt) {
    const previousBottom = player.y + player.radius;
    player.vy += gravity * dt;
    player.y += player.vy * dt;
    if (!award.reset) {
      spawnCrumbs(player.x, player.y + player.radius, 1);
      if (player.y - cameraY < -120) {
        resetStack();
        objective = null;
        apples = [];
        pendingApple = null;
        appleTimer = 0;
        appleTurn = false;
        coinsOnScreen = [];
        player.x = width / 2;
        player.y = -150;
        player.vy = 0;
        award.reset = true;
      }
    } else if (player.vy > 0 && previousBottom <= support.y + 4 && player.y + player.radius >= support.y) {
      player.y = support.y - player.radius;
      player.vy = 0;
      player.onGround = true;
      award = null;
      respawnTimer = .6;
      spawnCrumbs(player.x, player.y + player.radius, 9);
      hint.textContent = "Fresh stack! Keep hopping!";
    }
    updateParticles(dt);
  }

  let respawnTimer = 0;

  function objectiveGone() {
    return objective.dir < 0 ? objective.x + objective.width < 0 : objective.x > width;
  }

  function updateParticles(dt) {
    particles = particles.filter((particle) => particle.life > 0);
    particles.forEach((particle) => {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 300 * dt;
    });
  }

  function spawnApple(dir, speedMultiplier, red) {
    apples.push({
      dir,
      red,
      x: dir > 0 ? -appleRadius * 2 : width + appleRadius * 2,
      y: support.y - appleRadius,
      radius: appleRadius,
      speed: (width / 2 + platformWidth + 24) / 2.4 * speedFactor() * speedMultiplier
    });
  }

  function updateApples(dt) {
    if (appleTurn && !respawnTimer && !apples.length && !pendingApple) {
      appleTimer -= dt;
      if (appleTimer <= 0) {
        const dir = Math.random() < .5 ? 1 : -1;
        spawnApple(dir, 1.35, false);
        pendingApple = { delay: .4 + Math.random() * 1.4, dir: -dir, speedMultiplier: 1 + Math.random() * .9 };
      }
    }
    if (pendingApple && !respawnTimer) {
      pendingApple.delay -= dt;
      if (pendingApple.delay <= 0) {
        spawnApple(pendingApple.dir, pendingApple.speedMultiplier, true);
        pendingApple = null;
      }
    }
    for (const apple of apples) {
      apple.x += apple.dir * apple.speed * dt;
      apple.y += (support.y - apple.radius - apple.y) * Math.min(1, dt * 8);
      const dx = player.x - apple.x;
      const dy = player.y - apple.y;
      if (dx * dx + dy * dy < (player.radius + apple.radius * .85) ** 2) {
        hitPlayer(apple.dir, apple.speed);
        return;
      }
    }
    const before = apples.length;
    apples = apples.filter((apple) => apple.dir > 0 ? apple.x - apple.radius <= width + 20 : apple.x + apple.radius >= -20);
    if (before && !apples.length && !pendingApple) {
      appleTurn = Math.random() < .3;
      appleTimer = .6;
    }
  }

  function update(dt) {
    if (state !== "playing") return;
    if (badge) {
      badge.time += dt;
      if (badge.time >= badgeDuration) badge = null;
    }
    if (knock) {
      updateKnock(dt);
      return;
    }
    if (award) {
      updateAward(dt);
      return;
    }
    giftRibbonTime = Math.max(0, giftRibbonTime - dt);
    respawnTimer = Math.max(0, respawnTimer - dt);
    updateApples(dt);
    if (knock) return;
    if (!player.onGround) {
      const previousBottom = player.y + player.radius;
      player.vy += gravity * jumpSpeedFactor() * dt;
      player.y += player.vy * dt;
      const playerBottom = player.y + player.radius;

      if (objective) {
        objective.x += objective.dir * objective.speed * dt;
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
            hitPlayer(objective.dir, objective.speed);
            return;
          }
          if (objectiveGone()) objective = null;
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
      objective.x += objective.dir * objective.speed * dt;
      const nearestX = Math.max(objective.x, Math.min(player.x, objective.x + objective.width));
      const nearestY = Math.max(objective.y, Math.min(player.y, objective.y + objective.height));
      const dx = player.x - nearestX;
      const dy = player.y - nearestY;
      if (dx * dx + dy * dy < player.radius * player.radius) {
        hitPlayer(objective.dir, objective.speed);
        return;
      }
      if (objectiveGone()) objective = null;
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

    tower.forEach((platform) => {
      if (platform.opening) platform.openTime += dt;
      if (platform.squishTime < squishDuration) platform.squishTime += dt;
    });
    if (player.y - cameraY < height * playerScreenRatio) {
      cameraY = player.y - height * playerScreenRatio;
    }
    if (respawnTimer === 0 && !objective && !appleTurn && !apples.length && !pendingApple) createObjective();

    updateParticles(dt);
    if (player.y - cameraY > height + 90) loseLife();
  }

  function roundRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
  }

  function squishScale(platform) {
    if (platform.squishTime === undefined || platform.squishTime >= squishDuration) return 1;
    return 1 - squishAmount * Math.sin(Math.PI * platform.squishTime / squishDuration);
  }

  function drawPlatform(platform) {
    const screenY = platform.y - cameraY;
    if (screenY < -2 * (platform.height + 12) || screenY > height + 20) return;
    const x = platform.x;
    const w = platform.width;
    ctx.save();
    ctx.translate(0, screenY);
    ctx.scale(1, 2);
    const squish = squishScale(platform);
    if (squish !== 1) {
      ctx.translate(0, platform.height / 2);
      ctx.scale(1, squish);
      ctx.translate(0, -platform.height / 2);
    }
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
    ctx.beginPath();
    ctx.ellipse(x + gift.width / 2, screenY + 5, 18, 12, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    if (gift.opening && gift.openTime > .12) {
      const t = gift.openTime;
      const fadeOut = Math.min(1, Math.max(0, (t - 1.1) / .4));
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = Math.min(1, (t - .12) / .3) * (1 - fadeOut);
      ctx.font = "27px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(gift.animal, x + gift.width / 2, platformScreenY + 2 - Math.min(t / .7, 1) * 50);
      ctx.restore();
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

  function drawApple(apple) {
    const r = apple.radius;
    ctx.save();
    ctx.translate(apple.x, apple.y - cameraY);
    ctx.fillStyle = "rgba(113, 75, 48, .13)";
    ctx.beginPath();
    ctx.ellipse(0, r + 2, r * .9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(apple.x / r);
    ctx.fillStyle = apple.red ? "#e0453a" : "#7cc94a";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = apple.red ? "#c4302b" : "#5fae38";
    ctx.beginPath();
    ctx.ellipse(r * .3, r * .25, r * .6, r * .65, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, .55)";
    ctx.beginPath();
    ctx.ellipse(-r * .4, -r * .4, r * .22, r * .12, -.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#6b4a2b";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, -r + 3);
    ctx.lineTo(2, -r - 5);
    ctx.stroke();
    ctx.fillStyle = "#3f8f2f";
    ctx.beginPath();
    ctx.ellipse(8, -r - 2, 6, 3, -.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHamster() {
    if (player.hidden) return;
    const x = player.x;
    const y = player.y - cameraY;
    const bob = player.onGround ? Math.sin(performance.now() / 180) * 1.5 : 0;
    const squishDrop = player.onGround && !knock && support ? support.height * (1 - squishScale(support)) : 0;
    ctx.save();
    if (knock) ctx.globalAlpha = Math.max(0, 1 - Math.max(0, knock.time - .1) / (knockDuration - .1));
    ctx.translate(x, y + bob + squishDrop);
    if (knock) ctx.rotate(knock.spin * knock.time);
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
    const alpha = Math.max(0, Math.min(1, elapsed / .2) * Math.min(1, giftRibbonTime / .4));
    const pop = 1 + Math.max(0, .25 - elapsed) * 1.6;
    const r = Math.min(56, width * .15);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(width / 2, height * .2);
    ctx.scale(pop, pop);
    ctx.fillStyle = "#a95330";
    ctx.beginPath();
    ctx.moveTo(-r * .5, r * .6);
    ctx.lineTo(-r * .7, r * 1.25);
    ctx.lineTo(-r * .35, r * 1.05);
    ctx.lineTo(-r * .1, r * 1.3);
    ctx.lineTo(-r * .05, r * .8);
    ctx.moveTo(r * .5, r * .6);
    ctx.lineTo(r * .7, r * 1.25);
    ctx.lineTo(r * .35, r * 1.05);
    ctx.lineTo(r * .1, r * 1.3);
    ctx.lineTo(r * .05, r * .8);
    ctx.fill();
    ctx.fillStyle = "#c96c3a";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f6ce69";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, r - 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.round(r * .6)}px system-ui`;
    ctx.fillText("🎁", 0, -r * .22);
    ctx.fillStyle = "#fffdf7";
    ctx.font = `900 ${Math.round(r * .2)}px system-ui`;
    ctx.fillText("GIFT FOUND!", 0, r * .42);
    ctx.restore();
  }

  function drawBadge() {
    if (!badge) return;
    const t = badge.time;
    const alpha = Math.max(0, Math.min(1, t / .3) * Math.min(1, (badgeDuration - t) / 1));
    const pop = 1 + Math.max(0, .3 - t) * 1.5;
    const r = Math.min(86, width * .22);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(width / 2, height * .34);
    ctx.scale(pop, pop);
    ctx.fillStyle = "#d9534f";
    ctx.beginPath();
    ctx.moveTo(-r * .55, r * .6);
    ctx.lineTo(-r * .85, r * 1.45);
    ctx.lineTo(-r * .45, r * 1.2);
    ctx.lineTo(-r * .15, r * 1.5);
    ctx.lineTo(-r * .1, r * .8);
    ctx.moveTo(r * .55, r * .6);
    ctx.lineTo(r * .85, r * 1.45);
    ctx.lineTo(r * .45, r * 1.2);
    ctx.lineTo(r * .15, r * 1.5);
    ctx.lineTo(r * .1, r * .8);
    ctx.fill();
    const gold = ctx.createLinearGradient(0, -r, 0, r);
    gold.addColorStop(0, "#ffe27a");
    gold.addColorStop(1, "#e6a02e");
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff6cf";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, r - 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.round(r * .62)}px system-ui`;
    ctx.fillText("🏆", 0, -r * .2);
    ctx.fillStyle = "#7a4a1d";
    ctx.font = `900 ${Math.round(r * .22)}px system-ui`;
    ctx.fillText(`${awardScore} HOPS!`, 0, r * .42);
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
    apples.forEach(drawApple);
    particles.forEach((particle) => {
      ctx.globalAlpha = Math.max(0, particle.life / .45);
      ctx.fillStyle = "#f5cc68";
      ctx.beginPath();
      ctx.arc(particle.x, particle.y - cameraY, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    drawHamster();

    if (objective && objective.x < width + objective.width && objective.x + objective.width > 0) {
      const tx = objective.x + objective.width / 2;
      const ty = objective.y - cameraY - 20;
      ctx.fillStyle = objective.kind === "gift" ? "#ba6d3e" : "#9a704c";
      ctx.font = "bold 12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(objective.kind === "gift" ? "GIFT!" : "JUMP!", tx, ty);
    }
    drawGiftRibbon();
    drawBadge();
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
