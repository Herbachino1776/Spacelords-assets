(async function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;

  // ---------- Helpers ----------
  const loadJSON = async (p) => { const r = await fetch(p); if (!r.ok) throw new Error(p); return r.json(); };
  const loadImage = (p) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = p; });

  // Manifest-aware sprite
  class Sprite {
    constructor(sheet, manifest, animName) {
      this.sheet = sheet;
      this.manifest = manifest;
      this.setAnim(animName || 'idle');
      this.flipX = false;
      this.x = 100; this.y = 260;
      this.speed = 1.2;
      this.hp = 100; this.maxHp = 100;
      this.facing = 1;
    }
    setAnim(name) {
      this.animName = name;
      this.frames = (this.manifest.animations[name] || { frames: [] }).frames;
      this.fi = 0; this.t = 0;
    }
    update(dt) {
      if (!this.frames || this.frames.length === 0) return;
      this.t += dt;
      const cur = this.frames[this.fi];
      const dur = cur.dur || 100;
      if (this.t >= dur) { this.t = 0; this.fi = (this.fi + 1) % this.frames.length; }
    }
    draw(ctx) {
      if (!this.frames || this.frames.length === 0) return;
      const f = this.frames[this.fi];
      const scale = 2; // crisp upscale
      const dx = Math.floor(this.x - (this.flipX ? (f.w - f.pivot.x) : f.pivot.x) * scale);
      const dy = Math.floor(this.y - f.pivot.y * scale);
      if (this.flipX) {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(this.sheet, f.x, f.y, f.w, f.h, Math.floor(-dx - f.w * scale), dy, f.w * scale, f.h * scale);
        ctx.restore();
      } else {
        ctx.drawImage(this.sheet, f.x, f.y, f.w, f.h, dx, dy, f.w * scale, f.h * scale);
      }
    }
    attackHitbox() { // simple forward arc
      const w = 40, h = 30;
      return {
        x: this.x + (this.flipX ? -w - 10 : 10),
        y: this.y - 60,
        w, h
      };
    }
  }

  // ---------- Load assets ----------
  const assets = {
    player: {
      sheet: await loadImage('assets/sprites/player/MantidPrime/MantidPrime_sheet.png'),
      manifest: await loadJSON('assets/sprites/player/MantidPrime/MantidPrime_manifest.json')
    },
    enemies: [
      {
        name: 'Celestis',
        sheet: await loadImage('assets/sprites/enemy_small/Celestis/Celestis_sheet.png'),
        manifest: await loadJSON('assets/sprites/enemy_small/Celestis/Celestis_manifest.json'),
        hp: 30, speed: 0.8
      },
      {
        name: 'Stardust',
        sheet: await loadImage('assets/sprites/enemy_small/Stardust/Stardust_sheet.png'),
        manifest: await loadJSON('assets/sprites/enemy_small/Stardust/Stardust_manifest.json'),
        hp: 35, speed: 1.0
      }
    ],
    boss: {
      sheet: await loadImage('assets/sprites/enemy_large/OrionLord/OrionLord_sheet.png'),
      manifest: await loadJSON('assets/sprites/enemy_large/OrionLord/OrionLord_manifest.json'),
      hp: 240, speed: 0.6
    }
  };

  // ---------- Build world ----------
  const player = new Sprite(assets.player.sheet, assets.player.manifest, 'idle');
  player.x = 120; player.y = 300;

  const enemies = [];
  let score = 0, wave = 1, bossAlive = false;

  function spawnEnemy() {
    const spec = assets.enemies[Math.floor(Math.random() * assets.enemies.length)];
    const s = new Sprite(spec.sheet, spec.manifest, 'walk');
    const left = Math.random() < 0.5;
    s.x = left ? -40 : canvas.width + 40;
    s.y = 300;
    s.flipX = left ? false : true;
    s.facing = left ? 1 : -1;
    s.hp = spec.hp; s.maxHp = spec.hp; s.speed = spec.speed;
    enemies.push(s);
  }
  function spawnWave(n) { for (let i = 0; i < n; i++) spawnEnemy(); }

  // ---------- Input ----------
  const keys = { left: false, right: false, jump: false, attack: false };
  const setKey = (k, v) => keys[k] = v;

  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a') setKey('left', true);
    if (e.key === 'ArrowRight' || e.key === 'd') setKey('right', true);
    if (e.key === ' ' || e.key === 'w' || e.key === 'ArrowUp') setKey('jump', true);
    if (e.key === 'j' || e.key === 'x') setKey('attack', true);
  });
  window.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a') setKey('left', false);
    if (e.key === 'ArrowRight' || e.key === 'd') setKey('right', false);
    if (e.key === ' ' || e.key === 'w' || e.key === 'ArrowUp') setKey('jump', false);
    if (e.key === 'j' || e.key === 'x') setKey('attack', false);
  });

  // Mobile buttons
  const bind = (id, k) => {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', e => { e.preventDefault(); setKey(k, true); });
    el.addEventListener('touchend',   e => { e.preventDefault(); setKey(k, false); });
    el.addEventListener('mousedown',  e => { e.preventDefault(); setKey(k, true); });
    el.addEventListener('mouseup',    e => { e.preventDefault(); setKey(k, false); });
    el.addEventListener('mouseleave', e => { e.preventDefault(); setKey(k, false); });
  };
  bind('left','left'); bind('right','right'); bind('jump','jump'); bind('attack','attack');

  // simple jump physics
  let vy = 0, onGround = true;

  // ---------- Game loop ----------
  let last = performance.now();
  spawnWave(4);

  function rectsOverlap(a, b) {
    return (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y);
  }

  function update(dt) {
    // Player move
    let moving = false;
    if (keys.left)  { player.x -= player.speed * dt * 0.25; player.flipX = true; player.facing = -1; moving = true; }
    if (keys.right) { player.x += player.speed * dt * 0.25; player.flipX = false; player.facing =  1; moving = true; }
    if (moving && onGround && player.animName !== 'walk') player.setAnim('walk');
    if (!moving && onGround && !keys.attack && player.animName !== 'idle') player.setAnim('idle');

    // Jump
    if (keys.jump && onGround) { vy = -6.5; onGround = false; player.setAnim('jump_up'); }

    // Gravity
    if (!onGround) {
      vy += 0.3;
      player.y += vy;
      if (vy > 0 && player.animName !== 'jump_down') player.setAnim('jump_down');
      if (player.y >= 300) { player.y = 300; vy = 0; onGround = true; player.setAnim(moving ? 'walk' : 'idle'); }
    }

    // Attack
    if (keys.attack && onGround) { player.setAnim('hook'); }

    // Enemies AI
    for (const e of enemies) {
      const dir = Math.sign(player.x - e.x);
      e.flipX = dir < 0;
      e.x += dir * e.speed * dt * 0.15;
      e.setAnim('walk');
      e.update(dt);
    }

    // Collisions: attack
    if (player.animName === 'hook' || player.animName === 'jab' || player.animName === 'jump_kick') {
      const hb = player.attackHitbox();
      for (const e of enemies) {
        const eb = { x: e.x - 20, y: e.y - 80, w: 40, h: 60 };
        if (rectsOverlap(hb, eb)) {
          e.hp -= 10;
        }
      }
    }

    // Cleanup dead enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      if (enemies[i].hp <= 0) { enemies.splice(i, 1); score += 10; }
    }

    // Spawn next wave (and occasional boss)
    if (enemies.length === 0) {
      wave++;
      if (wave % 3 === 0 && !bossAlive) {
        const b = new Sprite(assets.boss.sheet, assets.boss.manifest, 'walk');
        b.x = canvas.width + 60; b.y = 300; b.flipX = true; b.hp = assets.boss.hp; b.speed = assets.boss.speed;
        enemies.push(b); bossAlive = true;
      } else {
        spawnWave(4 + Math.min(8, wave)); // scale difficulty
      }
    }
    // Boss status
    bossAlive = enemies.some(e => e.sheet === assets.boss.sheet);

    // Update anims
    player.update(dt);
  }

  function draw() {
    ctx.fillStyle = '#111'; ctx.fillRect(0,0,canvas.width,canvas.height);

    // ground
    ctx.fillStyle = '#1d1d1d'; ctx.fillRect(0, 320, canvas.width, 40);

    // enemies
    for (const e of enemies) {
      e.draw(ctx);
      // simple HP pips
      ctx.fillStyle = '#700';
      ctx.fillRect(Math.floor(e.x - 20), Math.floor(e.y - 80), 40, 4);
      ctx.fillStyle = '#2f2';
      ctx.fillRect(Math.floor(e.x - 20), Math.floor(e.y - 80), Math.floor(40 * (e.hp / e.maxHp)), 4);
    }

    // player
    player.draw(ctx);

    // UI text
    ctx.fillStyle = '#ddd'; ctx.font = '12px monospace';
    ctx.fillText(`Wave ${wave}  Score ${score}`, 10, 14);
  }

  function loop(ts) {
    const dt = ts - last; last = ts;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
