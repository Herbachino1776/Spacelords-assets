/* ====== Spacelords SoR Demo — GitHub Pages (relative assets) ====== */
var ASSET_BASE = "./assets"; // uses your repo's assets folder directly

/* ===== Canvas & tiny HUD ===== */
var canvas = document.getElementById('game');
var ctx = canvas.getContext('2d', {alpha:false});
ctx.imageSmoothingEnabled = false;
var W = canvas.width, H = canvas.height;
var HUD = { lines:[], add:function(s){ this.lines.push(String(s)); if(this.lines.length>10) this.lines.shift(); } };

function drawBG(shift){
  var g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#0c0d16'); g.addColorStop(.55,'#101226'); g.addColorStop(1,'#0b0b12');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#6ab1f0';
  for (var i=0;i<40;i++){ var x=(i*97 + Math.floor((shift||0)*.3))%(W+100)-50; var y=20+(i*37)%200; ctx.fillRect(x,y,2,2); }
  ctx.fillStyle='#16161c'; ctx.fillRect(0,320,W,40);
}
function banner(text){
  ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#cfe9ff'; ctx.font='20px monospace';
  var w = ctx.measureText(text).width; ctx.fillText(text, (W-w)/2, H/2);
}
function hudText(){
  if (!HUD.lines.length) return;
  ctx.fillStyle='rgba(0,0,0,.45)'; ctx.fillRect(6,6,360,14*(HUD.lines.length+1));
  ctx.fillStyle='#d7f0ff'; ctx.font='12px monospace';
  for (var i=0;i<HUD.lines.length;i++) ctx.fillText(HUD.lines[i], 12, 20+i*14);
}

/* ===== Helpers ===== */
function loadImage(src){ return new Promise(function(res){ var i=new Image(); i.onload=function(){res(i)}; i.onerror=function(){res(null)}; i.src=src; }); }
function fetchJSON(url){ return fetch(url).then(function(r){return r.ok?r.json():null}).catch(function(){return null}); }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function rand(a,b){ return a + Math.random()*(b-a); }
function sign(x){ return x<0?-1:(x>0?1:0); }
function overlap(a,b){ return a && b && a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y; }
function sliceGrid(fw,fh,cols,rows){ var out=[],r,c; for(r=0;r<rows;r++)for(c=0;c<cols;c++) out.push({x:c*fw,y:r*fh,w:fw,h:fh,pivot:{x:fw/2,y:fh-8}}); return out; }

/* ===== Specs (from your kit) ===== */
var SPEC={ player:{fw:96,fh:96,cols:6,rows:4}, enemy_small:{fw:80,fh:80,cols:6,rows:3}, enemy_large:{fw:120,fh:120,cols:6,rows:4}, weapons:{fw:96,fh:48,cols:6,rows:2}, items:{fw:48,fh:48,cols:8,rows:2} };
var DUR={ idle:120, walk:90, jab:70, hook:85, hit:110, knockdown:120, rise:120, death:120, jump_start:80, jump_up:90, jump_down:90, land:110, jump_kick:80, attack:100 };

/* ===== Default anims if manifest is absent ===== */
function defaultAnims(cat, frames){
  function mk(a,b,d){ var arr=[]; for(var i=a;i<b;i++){ var f=Object.assign({},frames[i]); f.dur=d; arr.push(f);} return arr; }
  var m={};
  if(cat==='player'){ m.idle=mk(0,4,DUR.idle); m.walk=mk(4,10,DUR.walk); m.jab=mk(10,12,DUR.jab); m.hook=mk(12,16,DUR.hook); m.hit=mk(16,18,DUR.hit);
    m.jump_start=mk(18,19,DUR.jump_start); m.jump_up=mk(19,20,DUR.jump_up); m.jump_down=mk(20,21,DUR.jump_down); m.land=mk(21,22,DUR.land); m.jump_kick=mk(22,24,DUR.jump_kick); }
  else if(cat==='enemy_small'){ m.idle=mk(0,3,DUR.idle); m.walk=mk(3,7,DUR.walk); m.attack=mk(7,10,DUR.attack); m.hit=mk(10,12,DUR.hit); m.death=mk(12,18,DUR.death); }
  else if(cat==='enemy_large'){ m.idle=mk(0,4,DUR.idle); m.walk=mk(4,10,DUR.walk); m.attack=mk(10,14,DUR.attack); m.hit=mk(14,16,DUR.hit); m.knockdown=mk(16,18,DUR.knockdown); m.rise=mk(18,20,DUR.rise); m.death=mk(20,24,DUR.death); }
  else if(cat==='weapons'){ m.idle=mk(0,4,120); m.swing=mk(4,10,80); m.impact=mk(10,12,100); }
  return m;
}

/* ===== Load one spriteset (sheet + manifest if present) ===== */
function loadSet(category, name, spec){
  var base = ASSET_BASE + "/sprites/" + category + "/" + name + "/" + name;
  var sheetURL = base + "_sheet.png";
  var manifestURL = base + "_manifest.json";
  return Promise.all([loadImage(sheetURL), fetchJSON(manifestURL)]).then(function(arr){
    var sheet=arr[0], manifest=arr[1]; if(!sheet) return null;
    var anims={};
    if(manifest && manifest.animations){
      for(var k in manifest.animations){
        var frames=manifest.animations[k].frames, list=[];
        for(var i=0;i<frames.length;i++){ var f=frames[i];
          list.push({x:f.x,y:f.y,w:f.w,h:f.h,pivot:(f.pivot||{x:spec.fw/2,y:spec.fh-8}),dur:(f.dur||DUR[k]||100)});
        }
        anims[k.toLowerCase()]=list;
      }
    } else {
      anims = defaultAnims(category, sliceGrid(spec.fw,spec.fh,spec.cols,spec.rows));
    }
    return {sheet:sheet, anims:anims, spec:spec, name:name};
  });
}

/* ===== Items: parse icons from manifest if present ===== */
function loadItemSet(name){
  var base = ASSET_BASE + "/sprites/items/" + name + "/" + name;
  var sheetURL = base + "_sheet.png";
  var manifestURL = base + "_manifest.json";
  return Promise.all([loadImage(sheetURL), fetchJSON(manifestURL)]).then(function(arr){
    var sheet=arr[0], manifest=arr[1]; if(!sheet) return null;
    var icons=[]; // list of {x,y,w,h}
    if (manifest){
      var arrs = manifest.icons || manifest.frames || manifest.tiles;
      if (arrs && arrs.length){
        for (var i=0;i<arrs.length;i++){
          var f=arrs[i]; icons.push({x:f.x,y:f.y,w:f.w,h:f.h});
        }
      }
    }
    if (!icons.length){
      // grid fallback per SPEC.items
      var spec=SPEC.items, fw=spec.fw, fh=spec.fh, cols=spec.cols, rows=spec.rows;
      for (var r=0;r<rows;r++) for (var c=0;c<cols;c++) icons.push({x:c*fw,y:r*fh,w:fw,h:fh});
    }
    return { sheet:sheet, icons:icons, name:name };
  });
}

/* ===== Sprite classes ===== */
function Sprite(sheet,anims,scale){ this.sheet=sheet; this.anims=anims; this.scale=scale||2; this.set('idle'); this.flip=false; this.x=120; this.y=300; this.speed=1; this.hp=100; this.maxHp=100; }
Sprite.prototype.set=function(n){ this.anim=n; this.frames=this.anims[n]||[]; this.i=0; this.t=0; };
Sprite.prototype.update=function(dt){ if(!this.frames.length) return; this.t+=dt; var f=this.frames[this.i]; if(this.t>=(f.dur||100)){ this.t=0; this.i=(this.i+1)%this.frames.length; } };
Sprite.prototype.draw=function(g){ var f=this.frames[this.i]; if(!f) return; var s=this.scale; var px=(f.pivot&&f.pivot.x)||f.w/2, py=(f.pivot&&f.pivot.y)||(f.h-8);
  var dx=Math.floor(this.x - (this.flip ? (f.w-px) : px)*s), dy=Math.floor(this.y - py*s);
  if(this.flip){ g.save(); g.scale(-1,1); g.drawImage(this.sheet,f.x,f.y,f.w,f.h, Math.floor(-dx - f.w*s), dy, f.w*s, f.h*s); g.restore(); }
  else g.drawImage(this.sheet,f.x,f.y,f.w,f.h, dx,dy, f.w*s, f.h*s);
};
Sprite.prototype.hitbox=function(){ return {x:this.x-18,y:this.y-68,w:36,h:64}; };
Sprite.prototype.atkbox=function(){ var w=44,h=30; return {x:this.x+(this.flip?-w-12:12), y:this.y-60, w:w, h:h}; };

function Player(sheet,anims){ Sprite.call(this,sheet,anims,2); this.speed=1.5; this.lives=3; this.inv=0; this.weapon=null; this.wSet=null; }
Player.prototype=Object.create(Sprite.prototype);
Player.prototype.think=function(dt,input){
  if(this.inv>0) this.inv-=dt;
  var moving=false;
  if(input.left){ this.x-=this.speed*dt*0.25; this.flip=true; moving=true; }
  if(input.right){ this.x+=this.speed*dt*0.25; this.flip=false; moving=true; }
  if(input.attack){ this.set(this.weapon? 'hook':'jab'); } else if(moving){ this.set('walk'); } else { this.set('idle'); }
  this.x = clamp(this.x,16,W-16);
};
Player.prototype.draw=function(g){
  Sprite.prototype.draw.call(this,g);
  if(this.weapon && this.wSet && this.wSet.anims && this.wSet.anims.swing){
    var list=this.wSet.anims.swing; var f=list[(this.i)%list.length]; if(!f) return;
    var s=2, px=(f.pivot&&f.pivot.x)||f.w/2, py=(f.pivot&&f.pivot.y)||(f.h-4);
    var offX=this.flip?-22:22, offY=-30;
    var dx=Math.floor(this.x+offX - (this.flip?(f.w-px):px)*s), dy=Math.floor(this.y+offY - py*s);
    if(this.flip){ g.save(); g.scale(-1,1); g.drawImage(this.wSet.sheet,f.x,f.y,f.w,f.h, Math.floor(-dx - f.w*s), dy, f.w*s, f.h*s); g.restore(); }
    else g.drawImage(this.wSet.sheet,f.x,f.y,f.w,f.h, dx,dy, f.w*s, f.h*s);
  }
};

function Enemy(sheet,anims){ Sprite.call(this,sheet,anims,2); this.speed=0.9; }
Enemy.prototype=Object.create(Sprite.prototype);
Enemy.prototype.ai=function(dt,player){ var dx=player.x-this.x; this.flip=dx<0; if(Math.abs(dx)>60){ this.x+=sign(dx)*this.speed*dt*0.2; this.set('walk'); } else { this.set('attack'); } };

function Boss(sheet,anims){ Enemy.call(this,sheet,anims); this.speed=0.6; this.hp=240; this.maxHp=240; }
Boss.prototype=Object.create(Enemy.prototype);

/* ===== Pickups, crates ===== */
function Pickup(kind,x,y,icon){ this.kind=kind; this.x=x; this.y=y; this.vy=-0.15; this.icon=icon||null; }
Pickup.prototype.update=function(dt){ this.vy+=0.0008*dt; this.y+=this.vy; if(this.y>300){ this.y=300; this.vy=0; } };
Pickup.prototype.box=function(){ return {x:this.x-12,y:this.y-16,w:24,h:24}; };
Pickup.prototype.draw=function(g){
  if(this.icon && this.icon.sheet){ var s=1; g.drawImage(this.icon.sheet,this.icon.x,this.icon.y,this.icon.w,this.icon.h, Math.floor(this.x-12),Math.floor(this.y-16), this.icon.w*s,this.icon.h*s); }
  else { g.fillStyle=this.kind==='hp'?'#63d24f':(this.kind==='weapon'?'#cfe':'#9bd0f6'); g.fillRect(Math.floor(this.x-8),Math.floor(this.y-12),16,16); }
};
function Crate(x,y){ this.x=x; this.y=y; this.hp=3; this.dead=false; }
Crate.prototype.draw=function(g){ g.fillStyle='#593c1f'; g.fillRect(Math.floor(this.x-12),Math.floor(this.y-16),24,16); g.strokeStyle='#2a1a0f'; g.strokeRect(Math.floor(this.x-12),Math.floor(this.y-16),24,16); };
Crate.prototype.hit=function(){ this.hp--; if(this.hp<=0) this.dead=true; };
Crate.prototype.box=function(){ return {x:this.x-12,y:this.y-16,w:24,h:16}; };

/* ===== UI ===== */
var hpBarImg=null;
loadImage(ASSET_BASE + "/ui/hp_bar.png").then(function(i){ hpBarImg=i; });

/* ===== Input ===== */
var input={left:false,right:false,jump:false,attack:false};
function setK(k,v){ input[k]=v; }
addEventListener('keydown',function(e){ if(e.key==='ArrowLeft'||e.key==='a')setK('left',true);
  if(e.key==='ArrowRight'||e.key==='d')setK('right',true);
  if(e.key===' '||e.key==='ArrowUp'||e.key==='w')setK('jump',true);
  if(e.key==='j'||e.key==='x')setK('attack',true);});
addEventListener('keyup',function(e){ if(e.key==='ArrowLeft'||e.key==='a')setK('left',false);
  if(e.key==='ArrowRight'||e.key==='d')setK('right',false);
  if(e.key===' '||e.key==='ArrowUp'||e.key==='w')setK('jump',false);
  if(e.key==='j'||e.key==='x')setK('attack',false);});
['left','right','jump','attack'].forEach(function(id){
  var el=document.getElementById(id); if(!el) return;
  el.addEventListener('touchstart',function(e){e.preventDefault();setK(id,true);});
  el.addEventListener('touchend',function(e){e.preventDefault();setK(id,false);});
  el.addEventListener('mousedown',function(e){e.preventDefault();setK(id,true);});
  el.addEventListener('mouseup',function(e){e.preventDefault();setK(id,false);});
  el.addEventListener('mouseleave',function(e){e.preventDefault();setK(id,false);});
});

/* ===== World ===== */
var STATE={LOCKED:0,TRANSITION:1,BOSS:2,WIN:3,LOSE:4};
var game={ state:STATE.LOCKED, stage:1, score:0, player:null, enemies:[], pickups:[], crates:[], boss:null, shift:0 };

/* ===== Known names — we attempt all and use what exists ===== */
var TRY_PLAYER  = ["MantidPrime","Scarabos","InsectHero","Player"];
var TRY_SMALLS  = ["Celestis","Stardust","Nebulite","Drone","Grub"];
var TRY_LARGES  = ["OrionLord","Titanus","Overseer"];
var TRY_WEAPONS = ["StingerBlade","CosmicStaff","PlasmaWhip","NovaSword"];
var ITEM_NAME   = "CosmicLoot";

/* ===== Boot: load everything that actually exists, then run ===== */
(function boot(){
  drawBG(0); HUD.add("Loading assets from "+ASSET_BASE+" …");

  var playerSet=null, smallSets=[], largeSets=[], weaponSets=[], itemSet=null;

  function seqLoad(names, loader, done){
    var out=[], idx=0;
    function next(){
      if (idx>=names.length) return done(out);
      loader(names[idx], function(res){ if(res) out.push(res); idx++; next(); });
    }
    next();
  }

  function loadPlayer(name, cb){ loadSet('player', name, SPEC.player).then(function(s){ if(s){ HUD.add("player ✓ "+name); if(!playerSet) playerSet=s; } cb(s); }); }
  function loadSmall(name, cb){ loadSet('enemy_small', name, SPEC.enemy_small).then(function(s){ if(s){ HUD.add("small  ✓ "+name); smallSets.push(s);} cb(s); }); }
  function loadLarge(name, cb){ loadSet('enemy_large', name, SPEC.enemy_large).then(function(s){ if(s){ HUD.add("large  ✓ "+name); largeSets.push(s);} cb(s); }); }
  function loadWeapon(name,cb){ loadSet('weapons', name, SPEC.weapons).then(function(s){ if(s){ HUD.add("weapon ✓ "+name); weaponSets.push(s);} cb(s); }); }

  seqLoad(TRY_PLAYER, loadPlayer, function(){
    seqLoad(TRY_SMALLS, loadSmall, function(){
      seqLoad(TRY_LARGES, loadLarge, function(){
        seqLoad(TRY_WEAPONS, loadWeapon, function(){
          loadItemSet(ITEM_NAME).then(function(s){ if(s){ HUD.add("items  ✓ "+ITEM_NAME); itemSet=s; } start(); });
        });
      });
    });
  });

  function start(){
    if (!playerSet && largeSets.length){
      HUD.add("No player sheet; using "+largeSets[0].name+" as player");
      playerSet = largeSets[0];
    }
    if (!playerSet){
      drawBG(0); banner("No usable player sheet in assets/"); HUD.add("Place a player sheet in assets/sprites/player/<Name>/<Name>_sheet.png"); return;
    }

    game.player = new Player(playerSet.sheet, playerSet.anims);
    game.player.x=120; game.player.y=300; game.player.hp=120; game.player.maxHp=120;

    function randomItemIcon(){
      if (!itemSet) return null;
      var icons=itemSet.icons; var f=icons[(Math.random()*icons.length)|0];
      return { sheet:itemSet.sheet, x:f.x, y:f.y, w:f.w, h:f.h };
    }
    function spawnSmallWave(n){
      for (var i=0;i<n;i++){
        var sp = smallSets[(Math.random()*smallSets.length)|0];
        if (!sp) break;
        var e=new Enemy(sp.sheet, sp.anims);
        e.x = Math.random()<0.5? -40 : W+40; e.y=300; e.hp=40; e.maxHp=40; e.speed=1.0;
        game.enemies.push(e);
      }
    }
    function spawnBoss(){
      var bs = largeSets[0];
      if (!bs) return;
      var b=new Boss(bs.sheet, bs.anims); b.x=W+60; b.y=300; b.flip=true; game.boss=b; game.enemies.push(b);
    }

    game.crates=[new Crate(240,304), new Crate(420,304)];
    spawnSmallWave(Math.max(3, smallSets.length));
    game.state=STATE.LOCKED;

    var last=performance.now();
    function loop(ts){ var dt=ts-last; last=ts; update(dt); draw(); requestAnimationFrame(loop); }
    requestAnimationFrame(loop);

    function update(dt){
      game.shift += dt*0.02;

      game.player.think(dt, input);
      game.player.update(dt);

      for (var i=0;i<game.enemies.length;i++){ var e=game.enemies[i]; e.ai(dt, game.player); e.update(dt); }

      if (input.attack){
        var hb = game.player.atkbox();
        for (var j=game.enemies.length-1;j>=0;j--){
          var ee=game.enemies[j];
          if (overlap(hb, ee.hitbox())){ ee.hp -= (game.player.weapon?3:1); if (ee.hp<=0) game.score+=10; }
        }
        for (var k=game.crates.length-1;k>=0;k--) if (!game.crates[k].dead && overlap(hb, game.crates[k].box())) game.crates[k].hit();
      }

      for (var m=game.enemies.length-1;m>=0;m--){
        if (game.enemies[m].hp<=0){
          var r=Math.random(); var kind=r<0.3?'weapon':(r<0.7?'hp':'item');
          var icon = kind==='item'? randomItemIcon() : null;
          game.pickups.push(new Pickup(kind, game.enemies[m].x, game.enemies[m].y-20, icon));
          game.enemies.splice(m,1);
        }
      }
      for (var cidx=game.crates.length-1;cidx>=0;cidx--){
        if (game.crates[cidx].dead){
          var r2=Math.random(); var kind2=r2<0.5?'hp':'weapon';
          game.pickups.push(new Pickup(kind2, game.crates[cidx].x, game.crates[cidx].y-10, randomItemIcon()));
          game.crates.splice(cidx,1);
        }
      }
      for (var p=game.pickups.length-1;p>=0;p--){
        var pp=game.pickups[p]; pp.update(dt);
        var playerHB = game.player.hitbox();
        if (overlap(playerHB, pp.box())){
          if (pp.kind==='hp'){ game.player.hp = clamp(game.player.hp+20, 0, game.player.maxHp); }
          // weapons optional — enable when weapon sheets exist
          game.pickups.splice(p,1);
        }
      }

      for (var q=0;q<game.enemies.length;q++){
        var en=game.enemies[q];
        var atk={x:en.x + (en.flip?-56:12), y:en.y-60, w:44, h:30};
        var playerHB2 = game.player.hitbox();
        if (en.anim==='attack' && overlap(atk, playerHB2) && game.player.inv<=0){
          game.player.hp -= 5; game.player.inv = 500;
          if (game.player.hp <= 0) {
            game.player.lives--;
            if (game.player.lives<0) game.state=STATE.LOSE;
            game.player.hp = game.player.maxHp; game.player.x=120; game.player.y=300;
          }
        }
      }

      if (game.enemies.length===0 && !game.boss && largeSets.length){
        spawnBoss();
      }
      if (game.boss && game.boss.hp<=0){ game.boss=null; game.state=STATE.WIN; }
    }

    function draw(){
      drawBG(game.shift);
      for (var i=0;i<game.crates.length;i++) game.crates[i].draw(ctx);
      for (var j=0;j<game.enemies.length;j++) game.enemies[j].draw(ctx);
      game.player.draw(ctx);
      for (var p=0;p<game.pickups.length;p++) game.pickups[p].draw(ctx);

      // UI
      var hpw=160, hpx=10, hpy=28;
      if (hpBarImg) ctx.drawImage(hpBarImg, hpx-2, hpy-2);
      ctx.fillStyle='#400'; ctx.fillRect(hpx,hpy,hpw,8);
      ctx.fillStyle='#2f2'; ctx.fillRect(hpx,hpy, Math.floor(hpw*(game.player.hp/game.player.maxHp)), 8);
      ctx.strokeStyle='#999'; ctx.strokeRect(hpx-1,hpy-1,hpw+2,10);

      ctx.fillStyle='#ddd'; ctx.font='12px monospace';
      ctx.fillText('Stage '+game.stage+'   Score '+game.score, 10, 14);

      hudText();
      if (game.state===STATE.TRANSITION) banner('GO →');
      if (game.state===STATE.WIN)  banner('VICTORY!');
      if (game.state===STATE.LOSE) banner('YOU FALL…');
    }
  }
})();
