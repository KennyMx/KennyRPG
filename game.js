/*
 * The Village That Forgot - a complete 2D side-scrolling story game (Phaser 3).
 *
 * All art is generated procedurally with Phaser Graphics (no external image
 * assets are loaded), so there is nothing to license or attribute. Simple
 * sound effects are synthesized with the Web Audio API (see the SFX class).
 *
 * Stage 1: title screen, side-scrolling village, player movement + jump,
 *   camera follow, ground collision, Mira NPC, dialogue box.
 * Stage 2: player stats, inventory, equipment, quests, item rewards, toasts.
 * Stage 3: multiple data-driven areas, area transitions, Elder Bram +
 *   Blacksmith Doran, the Leather Armor reward.
 * Stage 4 (final): the forest beyond the gate, simple side-scrolling combat
 *   with shadow enemies, the Broken Memory Crystal, the Memory Shrine, the
 *   Memory Spirit's reveal, and one ending screen ("Truth Restored").
 *
 * The story is intentionally ONE linear path with ONE ending.
 */

const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;
const WORLD_WIDTH = 3200;
const GROUND_TOP = 472; // y of the walkable surface

/* ------------------------------------------------------------------ *
 *  Procedural humanoid sprite drawing
 * ------------------------------------------------------------------ */

// Draws a thick, rounded limb (used for arms and legs) as a filled quad
// with rounded joint caps.
function drawLimb(g, x1, y1, x2, y2, width, color) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (width / 2);
  const ny = (dx / len) * (width / 2);
  g.fillStyle(color, 1);
  g.fillPoints(
    [
      { x: x1 + nx, y: y1 + ny },
      { x: x2 + nx, y: y2 + ny },
      { x: x2 - nx, y: y2 - ny },
      { x: x1 - nx, y: y1 - ny },
    ],
    true
  );
  g.fillCircle(x1, y1, width / 2);
  g.fillCircle(x2, y2, width / 2);
}

// Pose tables describe foot and hand positions for each animation frame.
const POSES = {
  idle: { lFoot: 28, rFoot: 36, lHand: 23, rHand: 41, footY: 80, handY: 53 },
  walk1: { lFoot: 33, rFoot: 31, lHand: 20, rHand: 44, footY: 80, handY: 53 },
  walk2: { lFoot: 23, rFoot: 41, lHand: 28, rHand: 38, footY: 80, handY: 53 },
  jump: { lFoot: 26, rFoot: 38, lHand: 19, rHand: 45, footY: 74, handY: 47 },
};

// Builds one humanoid texture for the given palette and pose, then registers
// it under `key` so it can be used by sprites.
function makeHumanoid(scene, key, c, poseName) {
  const p = POSES[poseName];
  const W = 64;
  const H = 86;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  const leftHip = 28;
  const rightHip = 36;
  const leftShoulder = 25;
  const rightShoulder = 39;

  // Back leg + back arm first (slightly darker) for a sense of depth.
  drawLimb(g, rightHip, 58, p.rFoot, p.footY, 8, c.pantsDark);
  g.fillStyle(c.boots, 1);
  g.fillEllipse(p.rFoot + 2, p.footY + 2, 12, 7);
  drawLimb(g, rightShoulder, 35, p.rHand, p.handY, 6, c.tunicDark);
  g.fillStyle(c.skin, 1);
  g.fillCircle(p.rHand, p.handY, 3.2);

  // Front leg.
  drawLimb(g, leftHip, 58, p.lFoot, p.footY, 8, c.pants);
  g.fillStyle(c.boots, 1);
  g.fillEllipse(p.lFoot + 2, p.footY + 2, 12, 7);

  // Torso: either a long robe (elders) or a tunic with a belt.
  if (c.robe) {
    g.fillStyle(c.tunic, 1);
    g.fillPoints(
      [{ x: 23, y: 30 }, { x: 41, y: 30 }, { x: 49, y: 80 }, { x: 15, y: 80 }],
      true
    );
    g.fillStyle(c.tunicDark, 1);
    g.fillPoints(
      [{ x: 32, y: 30 }, { x: 41, y: 30 }, { x: 49, y: 80 }, { x: 32, y: 80 }],
      true
    );
    g.fillStyle(c.belt, 1);
    g.fillRect(20, 50, 24, 4);
  } else {
    g.fillStyle(c.tunic, 1);
    g.fillRoundedRect(22, 29, 20, 30, 6);
    g.fillStyle(c.tunicDark, 1);
    g.fillRoundedRect(33, 29, 9, 30, { tl: 0, tr: 6, bl: 0, br: 6 });
    g.fillStyle(c.belt, 1);
    g.fillRect(22, 51, 20, 4);
    g.fillStyle(c.accent, 1);
    g.fillRect(31, 51, 3, 4);
  }

  // Optional work apron (blacksmith).
  if (c.apron) {
    g.fillStyle(c.apronColor || 0x6b4a2e, 1);
    g.fillRoundedRect(24, 33, 16, 30, 4);
    g.fillStyle(0x000000, 0.12);
    g.fillRect(24, 52, 16, 2);
    g.fillStyle(c.apronColor || 0x6b4a2e, 1);
    g.fillRect(27, 30, 3, 5);
    g.fillRect(34, 30, 3, 5);
  }

  // Front arm.
  drawLimb(g, leftShoulder, 35, p.lHand, p.handY, 6, c.tunic);
  g.fillStyle(c.skin, 1);
  g.fillCircle(p.lHand, p.handY, 3.2);

  // Neck.
  g.fillStyle(c.skin, 1);
  g.fillRect(29, 26, 6, 6);

  // Head: hair cap behind, face in front, hair fringe on top.
  g.fillStyle(c.hair, 1);
  g.fillCircle(32, 16, 12);
  g.fillStyle(c.skin, 1);
  g.fillCircle(32, 19, 10);
  g.fillStyle(c.hair, 1);
  g.fillRoundedRect(20, 6, 24, 9, 5); // fringe
  if (c.longHair) {
    g.fillRoundedRect(20, 14, 6, 22, 3);
    g.fillRoundedRect(38, 14, 6, 22, 3);
  }

  // Subtle face: eyes + small mouth (small and calm, not cartoonish).
  g.fillStyle(0x2a2230, 1);
  g.fillCircle(29, 20, 1.4);
  g.fillCircle(35, 20, 1.4);
  if (!c.beard) {
    g.fillStyle(0xb5736b, 0.7);
    g.fillRect(30, 24, 4, 1.4);
  }

  // Optional beard (covers the chin and mouth) for older / rugged NPCs.
  if (c.beard) {
    g.fillStyle(c.hair, 1);
    g.fillPoints(
      [{ x: 23, y: 22 }, { x: 41, y: 22 }, { x: 36, y: 35 }, { x: 28, y: 35 }],
      true
    );
    g.fillRoundedRect(24, 21, 16, 7, 3);
  }

  // Optional held prop, drawn in front of the body near the front hand.
  if (c.prop === "staff") {
    const hx = p.lHand;
    g.fillStyle(0x6b4a2e, 1);
    g.fillRoundedRect(hx - 2, 14, 4, 68, 2);
    g.fillStyle(c.staffGem || 0x8fd6e0, 1);
    g.fillCircle(hx, 12, 6);
    g.fillStyle(0xffffff, 0.45);
    g.fillCircle(hx - 2, 10, 2);
  } else if (c.prop === "hammer") {
    const hx = p.lHand;
    g.fillStyle(0x5b3a21, 1);
    g.fillRoundedRect(hx - 2, 40, 4, 32, 2);
    g.fillStyle(0x565b67, 1);
    g.fillRoundedRect(hx - 10, 36, 20, 12, 3);
    g.fillStyle(0x3f444f, 1);
    g.fillRect(hx - 10, 36, 5, 12);
  }

  g.generateTexture(key, W, H);
  g.destroy();
}

/* ------------------------------------------------------------------ *
 *  Boot scene: generate all textures, then go to the title.
 * ------------------------------------------------------------------ */

class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create() {
    const player = {
      skin: 0xe8b48f,
      hair: 0x6b4a2b,
      tunic: 0x3f7d5a,
      tunicDark: 0x2f5f44,
      pants: 0x4a4f63,
      pantsDark: 0x383c4c,
      boots: 0x3a2a1e,
      belt: 0x5a3a22,
      accent: 0xc9a227,
      longHair: false,
    };
    makeHumanoid(this, "player_idle", player, "idle");
    makeHumanoid(this, "player_walk1", player, "walk1");
    makeHumanoid(this, "player_walk2", player, "walk2");
    makeHumanoid(this, "player_jump", player, "jump");

    const mira = {
      skin: 0xf0c39c,
      hair: 0x8a3b54,
      tunic: 0x7c4b9c,
      tunicDark: 0x5f3a78,
      pants: 0x53406b,
      pantsDark: 0x42334f,
      boots: 0x3a2440,
      belt: 0x8a5a2a,
      accent: 0xe8d27a,
      longHair: true,
    };
    makeHumanoid(this, "mira_idle", mira, "idle");
    makeHumanoid(this, "mira_walk1", mira, "walk1");
    makeHumanoid(this, "mira_walk2", mira, "walk2");

    // Stage 3 NPCs.
    const bram = {
      skin: 0xe6c6a2,
      hair: 0xd8d2c8, // grey/white (elderly)
      beard: true,
      longHair: false,
      tunic: 0x3b3566, // deep indigo robe
      tunicDark: 0x2c2750,
      pants: 0x2c2750,
      pantsDark: 0x232041,
      boots: 0x2a223e,
      belt: 0xb59a3a,
      accent: 0xb59a3a,
      robe: true,
      prop: "staff",
      staffGem: 0x8fd6e0,
    };
    makeHumanoid(this, "bram_idle", bram, "idle");

    const doran = {
      skin: 0xc98d63,
      hair: 0x2f2420,
      beard: true,
      longHair: false,
      tunic: 0x6e2f2a, // maroon shirt
      tunicDark: 0x55231f,
      pants: 0x3a3a40,
      pantsDark: 0x2e2e33,
      boots: 0x2a2018,
      belt: 0x3a2a1e,
      accent: 0xc9a227,
      apron: true,
      apronColor: 0x6b4a2e,
      prop: "hammer",
    };
    makeHumanoid(this, "doran_idle", doran, "idle");

    // Stage 4: forest enemies, the Memory Spirit, and the crystal pickup.
    makeShadowSlime(this, "shadow_slime");
    makeMemoryBat(this, "memory_bat");
    makeLostKnight(this, "lost_knight");
    makeMemorySpirit(this, "spirit_idle");
    makeCrystal(this, "crystal");

    this.scene.start("Title");
  }
}

/* ------------------------------------------------------------------ *
 *  Shared scenery drawing helpers (used by Title + Village).
 * ------------------------------------------------------------------ */

function drawHill(g, x, y, w, h, color) {
  g.fillStyle(color, 1);
  g.fillEllipse(x, y, w, h);
}

function drawTree(g, x, baseY) {
  // trunk
  g.fillStyle(0x5b3a21, 1);
  g.fillRoundedRect(x - 7, baseY - 70, 14, 72, 4);
  // layered canopy
  g.fillStyle(0x2f6b3a, 1);
  g.fillCircle(x, baseY - 92, 34);
  g.fillStyle(0x3a814a, 1);
  g.fillCircle(x - 22, baseY - 80, 26);
  g.fillCircle(x + 22, baseY - 80, 26);
  g.fillStyle(0x47995a, 1);
  g.fillCircle(x, baseY - 78, 28);
}

function drawHouse(g, x, baseY, bodyColor, roofColor) {
  const w = 150;
  const h = 110;
  const left = x - w / 2;
  const top = baseY - h;
  // wall
  g.fillStyle(bodyColor, 1);
  g.fillRoundedRect(left, top, w, h, 4);
  // timber frame accents
  g.fillStyle(0x6b4a2e, 1);
  g.fillRect(left, top, w, 6);
  g.fillRect(left + w / 2 - 3, top, 6, h);
  // roof
  g.fillStyle(roofColor, 1);
  g.fillTriangle(left - 14, top + 4, x, top - 56, x + w / 2 + 14, top + 4);
  g.fillStyle(0x000000, 0.12);
  g.fillTriangle(x, top - 56, x + w / 2 + 14, top + 4, x, top + 4);
  // door
  g.fillStyle(0x4a2f1c, 1);
  g.fillRoundedRect(x - 18, baseY - 50, 36, 50, { tl: 14, tr: 14, bl: 0, br: 0 });
  g.fillStyle(0xc9a227, 1);
  g.fillCircle(x + 10, baseY - 26, 2.2);
  // windows
  g.fillStyle(0xf2d99a, 0.95);
  g.fillRoundedRect(left + 18, top + 28, 30, 30, 4);
  g.fillRoundedRect(left + w - 48, top + 28, 30, 30, 4);
  g.fillStyle(0x6b4a2e, 1);
  g.fillRect(left + 18, top + 42, 30, 3);
  g.fillRect(left + 31, top + 28, 3, 30);
  g.fillRect(left + w - 48, top + 42, 30, 3);
  g.fillRect(left + w - 35, top + 28, 3, 30);
}

// Lantern post. Returns the world position of the glow so the scene can add
// a soft light sprite there.
function drawLantern(g, x, baseY) {
  g.fillStyle(0x3a2a1e, 1);
  g.fillRoundedRect(x - 4, baseY - 96, 8, 96, 3);
  g.fillStyle(0x2a1d14, 1);
  g.fillRect(x - 14, baseY - 104, 28, 6);
  // lantern housing
  g.fillStyle(0x4a3526, 1);
  g.fillRoundedRect(x - 11, baseY - 100, 22, 24, 4);
  g.fillStyle(0xffd98a, 1);
  g.fillRoundedRect(x - 8, baseY - 97, 16, 18, 3);
  return { x: x, y: baseY - 88 };
}

/* ------------------------------------------------------------------ *
 *  SFX: tiny Web Audio sound effects (no audio files needed).
 *  A single shared instance is used by every scene. The AudioContext is
 *  created lazily and resumed on the first user gesture (Start button).
 * ------------------------------------------------------------------ */
class SFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  _ensure() {
    if (!this.enabled) return;
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
      } catch (e) {
        this.enabled = false;
        return;
      }
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  // Play one short tone, optionally sliding the pitch to `slideTo`.
  tone(freq, dur, type = "square", vol = 0.1, slideTo = null) {
    if (!this.enabled) return;
    this._ensure();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur);
  }

  attack() {
    this.tone(440, 0.12, "square", 0.07, 180);
  }
  hit() {
    this.tone(220, 0.1, "sawtooth", 0.09, 90);
  }
  defeat() {
    this.tone(180, 0.32, "triangle", 0.11, 60);
  }
  hurt() {
    this.tone(150, 0.24, "sawtooth", 0.12, 70);
  }
  denied() {
    this.tone(120, 0.16, "square", 0.07, 90);
  }
  pickup() {
    this.tone(680, 0.1, "sine", 0.09, 1020);
    setTimeout(() => this.tone(1020, 0.12, "sine", 0.08, 1360), 90);
  }
  // A soft ascending chime for the memory-restoration moment.
  chime() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.5, "sine", 0.09), i * 140)
    );
  }
  gameover() {
    [330, 247, 196].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.4, "triangle", 0.11), i * 180)
    );
  }
}

const sfx = new SFX();

// #region agent log
function dbgLog(location, message, data, hypothesisId) {
  fetch("http://127.0.0.1:7530/ingest/dd490957-5254-4906-9b30-cad6a5e3031f", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "99f55f" },
    body: JSON.stringify({ sessionId: "99f55f", location, message, data, hypothesisId, timestamp: Date.now() }),
  }).catch(() => {});
}
// #endregion

/* ================================================================== *
 *  STAGE 2 SYSTEMS
 *  Data definitions + small manager classes. These are intentionally
 *  decoupled from the rendering so they are easy to grow in Stage 3+.
 * ================================================================== */

/*
 * Item catalog. Every item the game knows about lives here. To add a new
 * item later, add another entry with the same shape.
 *   slot: which equipment slot it fills ("weapon" | "armor" | "charm")
 *   attack / defense: stat bonuses granted while equipped
 */
const ITEMS = {
  wooden_blade: {
    id: "wooden_blade",
    name: "Wooden Blade",
    slot: "weapon",
    attack: 2,
    defense: 0,
    description: "A basic wooden training sword. +2 Attack.",
  },
  old_iron_sword: {
    id: "old_iron_sword",
    name: "Old Iron Sword",
    slot: "weapon",
    attack: 5,
    defense: 0,
    description: "Mira's old sword. Worn, but reliable. +5 Attack.",
  },
  torn_clothes: {
    id: "torn_clothes",
    name: "Torn Clothes",
    slot: "armor",
    attack: 0,
    defense: 0,
    description: "Your travel clothes. No real protection. +0 Defense.",
  },
  leather_armor: {
    id: "leather_armor",
    name: "Leather Armor",
    slot: "armor",
    attack: 0,
    defense: 3,
    description: "Sturdy boiled leather from Doran's forge. +3 Defense.",
  },
};

// Convenience: a short bonus label used in the menu, e.g. "+5 Atk".
function itemBonusLabel(item) {
  if (item.slot === "weapon") return "+" + item.attack + " Atk";
  if (item.slot === "armor") return "+" + item.defense + " Def";
  return "";
}

/*
 * Player: holds the raw stats. Attack/Defense are computed live from the
 * base value plus whatever is equipped, so equipping gear immediately
 * changes the numbers shown in the menu.
 */
class Player {
  constructor() {
    this.maxHP = 30;
    this.hp = 30;
    this.baseAttack = 0; // unarmed; equipment provides the rest
    this.baseDefense = 0;
    this.level = 1;
    this.gold = 0;
    this.equipment = null; // wired up by the scene after creation
  }

  get attack() {
    return this.baseAttack + (this.equipment ? this.equipment.attackBonus() : 0);
  }

  get defense() {
    return this.baseDefense + (this.equipment ? this.equipment.defenseBonus() : 0);
  }
}

/*
 * InventoryManager: a simple bag of item ids the player is carrying.
 * Equipped items are NOT in here (they live in the equipment slots).
 */
class InventoryManager {
  constructor() {
    this.items = [];
  }
  add(id) {
    this.items.push(id);
  }
  remove(id) {
    const i = this.items.indexOf(id);
    if (i >= 0) this.items.splice(i, 1);
  }
  has(id) {
    return this.items.includes(id);
  }
  list() {
    return this.items;
  }
}

/*
 * EquipmentManager: tracks what is in each slot and totals the stat bonuses.
 * Equipping pulls the item out of the inventory and sends the previously
 * equipped item back into the inventory.
 */
class EquipmentManager {
  constructor(inventory) {
    this.inventory = inventory;
    this.slots = { weapon: null, armor: null, charm: null };
  }

  // Used only for the starting loadout (does not touch the inventory).
  setInitial(slot, id) {
    this.slots[slot] = id;
  }

  get(slot) {
    return this.slots[slot];
  }

  equipById(id) {
    const item = ITEMS[id];
    if (!item) return;
    const slot = item.slot;
    const previous = this.slots[slot];
    this.inventory.remove(id);
    this.slots[slot] = id;
    if (previous) this.inventory.add(previous);
  }

  attackBonus() {
    return this._sum("attack");
  }
  defenseBonus() {
    return this._sum("defense");
  }
  _sum(stat) {
    let total = 0;
    Object.keys(this.slots).forEach((s) => {
      const id = this.slots[s];
      if (id) total += ITEMS[id][stat] || 0;
    });
    return total;
  }
}

/*
 * NotificationManager: small "toast" pop-ups stacked at the top of the
 * screen. Rendered above everything (including the menu) so the player
 * always sees quest/item updates.
 */
class NotificationManager {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.topY = 22;
  }

  notify(message, accent = 0xc9a227) {
    const s = this.scene;
    const w = Math.min(560, 90 + message.length * 9.5);
    const c = s.add.container(GAME_WIDTH / 2, -50).setScrollFactor(0).setDepth(300);

    const g = s.add.graphics();
    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(-w / 2 + 4, -15, w, 36, 12);
    g.fillStyle(0x1c1430, 0.97);
    g.fillRoundedRect(-w / 2, -18, w, 36, 12);
    g.lineStyle(2, accent, 1);
    g.strokeRoundedRect(-w / 2, -18, w, 36, 12);
    g.fillStyle(accent, 1);
    g.fillCircle(-w / 2 + 20, 0, 4.5);

    const txt = s.add
      .text(-w / 2 + 36, 0, message, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "16px",
        color: "#f4ecff",
      })
      .setOrigin(0, 0.5);

    c.add([g, txt]);
    this.items.push(c);
    this._reflow();
    s.time.delayedCall(2800, () => this._dismiss(c));
  }

  _reflow() {
    this.items.forEach((c, i) => {
      this.scene.tweens.add({
        targets: c,
        y: this.topY + i * 48,
        duration: 220,
        ease: "Back.out",
      });
    });
  }

  _dismiss(c) {
    const i = this.items.indexOf(c);
    if (i < 0) return;
    this.items.splice(i, 1);
    this.scene.tweens.add({
      targets: c,
      alpha: 0,
      y: c.y - 18,
      duration: 240,
      onComplete: () => c.destroy(),
    });
    this._reflow();
  }
}

/*
 * QuestManager: owns the active quest AND the tracker panel in the top-left
 * corner. Stage 3 makes this multi-quest: `startQuest` swaps in a new quest
 * (e.g. "Fragments of Yesterday" then "Into the Forest"). The scene drives
 * step completion and notifications so the exact wording stays in one place.
 */
class QuestManager {
  constructor(scene) {
    this.scene = scene;
    this.active = null; // { name, steps:[{text,done}], completed }
    this.maxSteps = 6;
    this._build();
  }

  _build() {
    const s = this.scene;
    this.container = s.add.container(18, 16).setScrollFactor(0).setDepth(60);
    this.container.setVisible(false);

    this.panelG = s.add.graphics(); // redrawn per quest to fit its step count

    this.label = s.add.text(14, 10, "QUEST", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "12px",
      color: "#c9a227",
      fontStyle: "bold",
    });
    this.nameText = s.add.text(14, 26, "", {
      fontFamily: "Georgia, serif",
      fontSize: "17px",
      color: "#f7e7a8",
      fontStyle: "bold",
    });
    this.container.add([this.panelG, this.label, this.nameText]);

    this.stepTexts = [];
    for (let i = 0; i < this.maxSteps; i++) {
      const t = s.add.text(16, 56 + i * 21, "", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "14px",
        color: "#9a8bc0",
      });
      t.setVisible(false);
      this.stepTexts.push(t);
      this.container.add(t);
    }
  }

  // Swap in a brand-new quest. `steps` is an array of plain strings.
  startQuest(name, steps) {
    this.active = {
      name,
      steps: steps.map((t) => ({ text: t, done: false })),
      completed: false,
    };
    this.container.setVisible(true);
    this.container.setAlpha(0);
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 200 });
    this.scene.notifications.notify("Quest Started: " + name);
    this.refresh();
  }

  completeStep(index) {
    if (this.active && this.active.steps[index]) this.active.steps[index].done = true;
    this.refresh();
  }

  markComplete() {
    if (this.active) this.active.completed = true;
    this.refresh();
  }

  refresh() {
    if (!this.active) return;
    const q = this.active;
    const w = 300;
    const h = 52 + q.steps.length * 21 + 8;

    // Redraw the panel to match the current quest's height.
    this.panelG.clear();
    this.panelG.fillStyle(0x000000, 0.3);
    this.panelG.fillRoundedRect(6, 6, w, h, 12);
    this.panelG.fillStyle(0x1b1430, 0.92);
    this.panelG.fillRoundedRect(0, 0, w, h, 12);
    this.panelG.lineStyle(2, 0xc9a227, 0.9);
    this.panelG.strokeRoundedRect(0, 0, w, h, 12);

    this.nameText.setText(q.completed ? q.name + "   (Complete)" : q.name);

    const activeIndex = q.steps.findIndex((s) => !s.done);
    for (let i = 0; i < this.maxSteps; i++) {
      const step = q.steps[i];
      if (!step) {
        this.stepTexts[i].setVisible(false);
        continue;
      }
      this.stepTexts[i].setVisible(true);
      let mark;
      let color;
      if (step.done) {
        mark = "\u2713"; // check mark (not an emoji)
        color = "#c9a227";
      } else if (i === activeIndex) {
        mark = "\u25B8"; // small right-pointing triangle
        color = "#ffffff";
      } else {
        mark = "\u2022"; // bullet
        color = "#9a8bc0";
      }
      this.stepTexts[i].setText(mark + "   " + step.text).setColor(color);
    }
  }
}

/*
 * DialogueManager: the polished dialogue box from Stage 1, wrapped in a
 * class. `start` takes a speaker name, an array of lines, and an optional
 * callback that fires once the conversation has fully closed (used to hand
 * the player the sword AFTER Mira finishes speaking).
 */
class DialogueManager {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.lines = [];
    this.index = 0;
    this.onComplete = null;
    this._build();
  }

  get isActive() {
    return this.active;
  }

  _build() {
    const s = this.scene;
    const boxW = 760;
    const boxH = 150;
    const x = (GAME_WIDTH - boxW) / 2;
    const y = GAME_HEIGHT - boxH - 26;

    this.container = s.add.container(0, 0).setScrollFactor(0).setDepth(100);

    const panel = s.add.graphics();
    panel.fillStyle(0x000000, 0.35);
    panel.fillRoundedRect(x + 6, y + 8, boxW, boxH, 18);
    panel.fillStyle(0x1b1430, 0.96);
    panel.fillRoundedRect(x, y, boxW, boxH, 18);
    panel.lineStyle(3, 0xc9a227, 1);
    panel.strokeRoundedRect(x, y, boxW, boxH, 18);
    panel.lineStyle(1, 0x6a4fa0, 0.8);
    panel.strokeRoundedRect(x + 8, y + 8, boxW - 16, boxH - 16, 12);

    const nameBg = s.add.graphics();
    nameBg.fillStyle(0xc9a227, 1);
    nameBg.fillRoundedRect(x + 28, y - 20, 150, 40, 10);
    nameBg.fillStyle(0x241733, 1);
    nameBg.fillRoundedRect(x + 31, y - 17, 144, 34, 8);
    this.nameText = s.add.text(x + 48, y - 8, "Mira", {
      fontFamily: "Georgia, serif",
      fontSize: "22px",
      color: "#f7e7a8",
      fontStyle: "bold",
    });

    this.bodyText = s.add.text(x + 36, y + 34, "", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "21px",
      color: "#f4ecff",
      wordWrap: { width: boxW - 72 },
      lineSpacing: 6,
    });

    this.arrow = s.add
      .text(x + boxW - 40, y + boxH - 34, "\u25BC", {
        fontFamily: "sans-serif",
        fontSize: "20px",
        color: "#c9a227",
      })
      .setOrigin(0.5);
    s.tweens.add({
      targets: this.arrow,
      alpha: 0.2,
      duration: 520,
      yoyo: true,
      repeat: -1,
    });

    const hint = s.add.text(x + 36, y + boxH - 30, "E / Enter to continue", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "13px",
      color: "#9a8bc0",
    });

    this.container.add([panel, nameBg, this.nameText, this.bodyText, this.arrow, hint]);
    this.container.setVisible(false);
  }

  start(speaker, lines, onComplete) {
    this.lines = lines;
    this.index = 0;
    this.onComplete = onComplete || null;
    this.active = true;
    this.nameText.setText(speaker);
    this.bodyText.setText(lines[0]);
    this.container.setVisible(true);
    this.container.setAlpha(0);
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 160 });
  }

  advance() {
    this.index++;
    if (this.index >= this.lines.length) {
      this.close();
      return;
    }
    this.bodyText.setText(this.lines[this.index]);
  }

  close() {
    this.active = false;
    const cb = this.onComplete;
    this.onComplete = null;
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 160,
      onComplete: () => {
        this.container.setVisible(false);
        if (cb) cb(); // reward/quest updates happen after the box closes
      },
    });
  }
}

/*
 * InventoryMenu: the full-screen overlay opened with "I". Shows player
 * stats, the three equipment slots, the carried item list with
 * descriptions, and an Equip control. Navigate with Up/Down (or W/S or the
 * mouse) and equip with Enter/E (or the Equip button). Close with I or Esc.
 */
class InventoryMenu {
  constructor(scene) {
    this.scene = scene;
    this.isOpen = false;
    this.selected = 0;
    this.items = [];
    this.maxRows = 6;
    this.rowH = 34;
    this.invX = 470;
    this.invY = 152;
    this.rowW = 388;
    this._build();
  }

  _build() {
    const s = this.scene;
    this.container = s.add.container(0, 0).setScrollFactor(0).setDepth(200);
    this.container.setVisible(false);

    const dim = s.add.graphics();
    dim.fillStyle(0x05030a, 0.62);
    dim.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const px = 80;
    const py = 58;
    const pw = 800;
    const ph = 424;
    const panel = s.add.graphics();
    panel.fillStyle(0x000000, 0.4);
    panel.fillRoundedRect(px + 8, py + 10, pw, ph, 20);
    panel.fillStyle(0x1b1430, 0.98);
    panel.fillRoundedRect(px, py, pw, ph, 20);
    panel.lineStyle(3, 0xc9a227, 1);
    panel.strokeRoundedRect(px, py, pw, ph, 20);
    panel.lineStyle(1, 0x6a4fa0, 0.7);
    panel.strokeRoundedRect(px + 8, py + 8, pw - 16, ph - 16, 14);
    panel.lineStyle(1, 0x3a2d55, 1);
    panel.lineBetween(452, py + 26, 452, py + ph - 18); // column divider

    const title = s.add
      .text(GAME_WIDTH / 2, py + 28, "Inventory  &  Equipment", {
        fontFamily: "Georgia, serif",
        fontSize: "24px",
        color: "#f7e7a8",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.container.add([dim, panel, title]);

    const headerStyle = {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "13px",
      color: "#c9a227",
      fontStyle: "bold",
    };
    const monoStyle = {
      fontFamily: "Consolas, 'Courier New', monospace",
      fontSize: "16px",
      color: "#f4ecff",
      lineSpacing: 8,
    };

    // ----- Left column: stats + equipment -----
    this.container.add(s.add.text(110, 124, "STATS", headerStyle));
    this.statsText = s.add.text(118, 150, "", monoStyle);
    this.container.add(this.statsText);

    this.container.add(s.add.text(110, 300, "EQUIPMENT", headerStyle));
    this.equipText = s.add.text(118, 326, "", monoStyle);
    this.container.add(this.equipText);

    // Footer controls hint.
    this.container.add(
      s.add.text(110, 452, "Up / Down: select    Enter / E: equip    I: close", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "13px",
        color: "#9a8bc0",
      })
    );

    // ----- Right column: inventory list -----
    this.container.add(s.add.text(470, 124, "INVENTORY", headerStyle));

    this.highlight = s.add.graphics();
    this.container.add(this.highlight);

    this.rowTexts = [];
    this.rowBonusTexts = [];
    for (let i = 0; i < this.maxRows; i++) {
      const ry = this.invY + i * this.rowH;
      const name = s.add
        .text(this.invX + 16, ry + this.rowH / 2, "", {
          fontFamily: "Trebuchet MS, sans-serif",
          fontSize: "17px",
          color: "#f4ecff",
        })
        .setOrigin(0, 0.5);
      const bonus = s.add
        .text(this.invX + this.rowW - 16, ry + this.rowH / 2, "", {
          fontFamily: "Consolas, 'Courier New', monospace",
          fontSize: "14px",
          color: "#9ad6a0",
        })
        .setOrigin(1, 0.5);
      const zone = s.add
        .zone(this.invX, ry, this.rowW, this.rowH)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      const idx = i;
      zone.on("pointerover", () => this._hoverRow(idx));
      zone.on("pointerdown", () => this._hoverRow(idx));
      this.rowTexts.push(name);
      this.rowBonusTexts.push(bonus);
      this.container.add([name, bonus, zone]);
    }

    // ----- Description box -----
    const dpanel = s.add.graphics();
    dpanel.fillStyle(0x110c22, 0.9);
    dpanel.fillRoundedRect(470, 362, 388, 70, 10);
    dpanel.lineStyle(1, 0x4a3a72, 1);
    dpanel.strokeRoundedRect(470, 362, 388, 70, 10);
    this.container.add(dpanel);
    this.descTitle = s.add.text(482, 370, "", {
      fontFamily: "Georgia, serif",
      fontSize: "16px",
      color: "#f7e7a8",
      fontStyle: "bold",
    });
    this.descText = s.add.text(482, 392, "", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "14px",
      color: "#d8cdf0",
      wordWrap: { width: 364 },
      lineSpacing: 3,
    });
    this.container.add([this.descTitle, this.descText]);

    // ----- Equip button -----
    this.eqBtnX = 678;
    this.eqBtnY = 440;
    this.eqBtnW = 180;
    this.eqBtnH = 34;
    this.equipBtnG = s.add.graphics();
    this.equipBtnText = s.add
      .text(this.eqBtnX + this.eqBtnW / 2, this.eqBtnY + this.eqBtnH / 2, "Equip  (Enter)", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "16px",
        color: "#241733",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const eqZone = s.add
      .zone(this.eqBtnX, this.eqBtnY, this.eqBtnW, this.eqBtnH)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    eqZone.on("pointerdown", () => this.equipSelected());
    this.container.add([this.equipBtnG, this.equipBtnText, eqZone]);
  }

  _itemName(id) {
    return id ? ITEMS[id].name : "(Empty)";
  }

  _hoverRow(i) {
    if (i < this.items.length) {
      this.selected = i;
      this.refresh();
    }
  }

  open() {
    this.isOpen = true;
    this.selected = 0;
    this.refresh();
    this.container.setVisible(true);
    this.container.setAlpha(0);
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 150 });
    this.scene.showPrompt(false);
  }

  close() {
    this.isOpen = false;
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 130,
      onComplete: () => this.container.setVisible(false),
    });
  }

  move(dir) {
    if (this.items.length === 0) return;
    this.selected = (this.selected + dir + this.items.length) % this.items.length;
    this.refresh();
  }

  equipSelected() {
    if (!this.isOpen || this.items.length === 0) return;
    const id = this.items[this.selected];
    this.scene.equipItem(id);
  }

  // Reads keyboard each frame while the menu is open.
  handleInput() {
    const s = this.scene;
    const JD = Phaser.Input.Keyboard.JustDown;
    if (JD(s.keys.menu) || JD(s.keys.esc)) {
      this.close();
      return;
    }
    if (JD(s.cursors.up) || JD(s.keys.navUp)) this.move(-1);
    if (JD(s.cursors.down) || JD(s.keys.navDown)) this.move(1);
    if (JD(s.keys.enter) || JD(s.keys.talk)) this.equipSelected();
  }

  refresh() {
    const eq = this.scene.equipment;
    const inv = this.scene.inventory;
    const pd = this.scene.playerData;

    this.statsText.setText(
      [
        "Level    " + pd.level,
        "HP       " + pd.hp + " / " + pd.maxHP,
        "Attack   " + pd.attack,
        "Defense  " + pd.defense,
        "Gold     " + pd.gold,
      ].join("\n")
    );

    this.equipText.setText(
      [
        "Weapon : " + this._itemName(eq.get("weapon")),
        "Armor  : " + this._itemName(eq.get("armor")),
        "Charm  : " + this._itemName(eq.get("charm")),
      ].join("\n")
    );

    this.items = inv.list();
    if (this.selected >= this.items.length) {
      this.selected = Math.max(0, this.items.length - 1);
    }

    for (let i = 0; i < this.maxRows; i++) {
      if (i < this.items.length) {
        const it = ITEMS[this.items[i]];
        this.rowTexts[i].setText(it.name);
        this.rowBonusTexts[i].setText(itemBonusLabel(it));
      } else {
        this.rowTexts[i].setText("");
        this.rowBonusTexts[i].setText("");
      }
    }

    this.highlight.clear();
    if (this.items.length > 0) {
      const ry = this.invY + this.selected * this.rowH;
      this.highlight.fillStyle(0xc9a227, 0.16);
      this.highlight.fillRoundedRect(this.invX, ry, this.rowW, this.rowH, 8);
      this.highlight.lineStyle(1, 0xc9a227, 0.6);
      this.highlight.strokeRoundedRect(this.invX, ry, this.rowW, this.rowH, 8);
    }

    if (this.items.length > 0) {
      const it = ITEMS[this.items[this.selected]];
      this.descTitle.setText(it.name);
      this.descText.setText(it.description);
    } else {
      this.descTitle.setText("No items");
      this.descText.setText("Talk to Mira to find something worth carrying.");
    }

    this._drawEquipButton(this.items.length > 0);
  }

  _drawEquipButton(enabled) {
    const g = this.equipBtnG;
    g.clear();
    g.fillStyle(enabled ? 0xc9a227 : 0x4a4560, 1);
    g.fillRoundedRect(this.eqBtnX, this.eqBtnY, this.eqBtnW, this.eqBtnH, 10);
    g.fillStyle(0xffffff, enabled ? 0.12 : 0.04);
    g.fillRoundedRect(this.eqBtnX, this.eqBtnY, this.eqBtnW, this.eqBtnH / 2, 10);
    this.equipBtnText.setColor(enabled ? "#241733" : "#9a8bc0");
  }
}

/* ================================================================== *
 *  STAGE 3 SYSTEMS
 *  NPCs, multiple side-scrolling areas, and area transitions. The world
 *  is data-driven: each area in AREAS knows how to draw itself and which
 *  NPCs / transitions it contains. AreaManager swaps areas in and out
 *  while the persistent systems (player, stats, inventory, quests) stay.
 * ================================================================== */

const NPC_RANGE = 120; // how close the player must be to talk

/*
 * NPC: a humanoid character the player can talk to. The actual dialogue
 * lives in the scene (so it can read quest state); this class only handles
 * the sprite, placement on the ground, and a gentle idle animation.
 */
class NPC {
  constructor(scene, def) {
    this.scene = scene;
    this.id = def.id;
    this.name = def.name;
    this.sprite = scene.physics.add
      .staticSprite(def.x, 300, def.texture)
      .setOrigin(0.5, 0.5)
      .setDepth(9);
    this.sprite.y = GROUND_TOP - this.sprite.height / 2 + 6 + (def.yOffset || 0);
    this.sprite.refreshBody();
    if (def.flip) this.sprite.setFlipX(true);
    if (def.alpha != null) this.sprite.setAlpha(def.alpha);

    this.events = [];
    if (def.animate && def.frames) {
      // Frame-swap idle (used by Mira).
      this.frames = def.frames;
      this.fi = 0;
      this.events.push(
        scene.time.addEvent({
          delay: 430,
          loop: true,
          callback: () => {
            if (scene.isBusy()) return;
            this.fi = (this.fi + 1) % this.frames.length;
            this.sprite.setTexture(this.frames[this.fi]);
          },
        })
      );
    } else {
      // Calm breathing bob for prop-holding NPCs (Bram, Doran).
      scene.tweens.add({
        targets: this.sprite,
        y: this.sprite.y - 3,
        duration: 1600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
    }
  }

  get x() {
    return this.sprite.x;
  }

  destroy() {
    this.events.forEach((e) => e.remove());
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.destroy();
  }
}

/* ---------- Stage 3 scenery drawing helpers ---------- */

function drawSignpost(g, x, baseY) {
  g.fillStyle(0x5b3a21, 1);
  g.fillRoundedRect(x - 4, baseY - 80, 8, 82, 2);
  g.fillStyle(0x7a5230, 1);
  g.fillRoundedRect(x - 36, baseY - 108, 72, 32, 5);
  g.lineStyle(2, 0x3a2616, 1);
  g.strokeRoundedRect(x - 36, baseY - 108, 72, 32, 5);
}

function drawDoorway(g, x, baseY) {
  g.fillStyle(0x4a4a55, 1);
  g.fillRoundedRect(x - 30, baseY - 120, 60, 120, { tl: 26, tr: 26, bl: 0, br: 0 });
  g.fillStyle(0x241a2e, 1);
  g.fillRoundedRect(x - 22, baseY - 104, 44, 104, { tl: 18, tr: 18, bl: 0, br: 0 });
  g.fillStyle(0xffd98a, 0.16);
  g.fillRoundedRect(x - 18, baseY - 98, 36, 98, { tl: 14, tr: 14, bl: 0, br: 0 });
}

function drawBanner(g, x, i) {
  const cols = [0x6e2f6b, 0x2f5f6e, 0x6e572f, 0x3a2f6e];
  const col = cols[i % cols.length];
  g.fillStyle(0x3a2a1e, 1);
  g.fillRect(x - 26, 56, 52, 6);
  g.fillStyle(col, 1);
  g.fillRect(x - 22, 60, 44, 120);
  g.fillTriangle(x - 22, 180, x + 22, 180, x, 200);
  g.fillStyle(0xe8d27a, 1);
  g.fillCircle(x, 112, 11);
  g.fillStyle(col, 1);
  g.fillCircle(x, 112, 5);
}

function drawBookshelf(g, x) {
  const baseY = GROUND_TOP;
  g.fillStyle(0x3a2616, 1);
  g.fillRoundedRect(x - 40, baseY - 200, 80, 200, 4);
  g.fillStyle(0x2a1c10, 1);
  for (let s = 0; s < 4; s++) g.fillRect(x - 36, baseY - 196 + s * 50, 72, 4);
  const cols = [0x8a3b3b, 0x3b6e8a, 0x6e8a3b, 0x8a7a3b, 0x5a3b8a];
  for (let s = 0; s < 4; s++) {
    let bx = x - 34;
    let k = s;
    while (bx < x + 30) {
      const bw = 5 + (k % 4);
      g.fillStyle(cols[k % cols.length], 1);
      g.fillRect(bx, baseY - 192 + s * 50, bw, 40);
      bx += bw + 2;
      k++;
    }
  }
}

function drawPortrait(g, x) {
  // A faded, faceless portrait: a memory the village can no longer recall.
  g.fillStyle(0x6b4a2e, 1);
  g.fillRoundedRect(x - 26, 150, 52, 64, 4);
  g.fillStyle(0x2a2438, 1);
  g.fillRoundedRect(x - 21, 155, 42, 54, 3);
  g.fillStyle(0x4a4660, 1);
  g.fillCircle(x, 178, 12);
  g.fillRect(x - 10, 190, 20, 16);
}

function drawCandleStand(g, x) {
  const baseY = GROUND_TOP;
  g.fillStyle(0x3a2e22, 1);
  g.fillEllipse(x, baseY, 22, 8);
  g.fillStyle(0x2a221a, 1);
  g.fillRoundedRect(x - 3, baseY - 150, 6, 150, 2);
  g.fillStyle(0xf0e6cf, 1);
  g.fillRoundedRect(x - 4, baseY - 168, 8, 18, 2);
}

function drawForge(g, x) {
  const baseY = GROUND_TOP;
  g.fillStyle(0x2e2b33, 1);
  g.fillRect(x - 18, baseY - 220, 36, 80); // chimney
  g.fillStyle(0x3a3640, 1);
  g.fillRoundedRect(x - 70, baseY - 150, 140, 150, 6);
  g.fillStyle(0x26232b, 1);
  g.fillRoundedRect(x - 70, baseY - 150, 140, 18, 6);
  g.fillStyle(0x1a1620, 1);
  g.fillRoundedRect(x - 40, baseY - 96, 80, 70, 8);
  g.fillStyle(0xff7a2a, 1);
  g.fillRoundedRect(x - 34, baseY - 90, 68, 60, 6);
  g.fillStyle(0xffd06a, 1);
  g.fillEllipse(x, baseY - 58, 50, 36);
}

function drawAnvil(g, x) {
  const baseY = GROUND_TOP;
  g.fillStyle(0x3a2a1c, 1);
  g.fillRect(x - 18, baseY - 26, 36, 26);
  g.fillStyle(0x44474f, 1);
  g.fillRoundedRect(x - 26, baseY - 44, 52, 16, 3);
  g.fillRect(x - 10, baseY - 30, 20, 8);
  g.fillTriangle(x - 26, baseY - 44, x - 46, baseY - 40, x - 26, baseY - 33);
}

function drawWeaponRack(g, x) {
  const baseY = GROUND_TOP;
  g.fillStyle(0x4a3526, 1);
  g.fillRoundedRect(x - 44, baseY - 120, 88, 12, 4);
  g.fillRect(x - 44, baseY - 120, 8, 120);
  g.fillRect(x + 36, baseY - 120, 8, 120);
  [x - 26, x, x + 26].forEach((wx) => {
    g.fillStyle(0xb8bcc4, 1);
    g.fillRect(wx - 2, baseY - 108, 4, 60);
    g.fillStyle(0x6b4a2e, 1);
    g.fillRect(wx - 6, baseY - 50, 12, 6);
    g.fillRect(wx - 2, baseY - 46, 4, 12);
  });
}

function drawCrate(g, x) {
  const baseY = GROUND_TOP;
  g.fillStyle(0x6b4a2e, 1);
  g.fillRoundedRect(x - 22, baseY - 44, 44, 44, 3);
  g.lineStyle(3, 0x4a3018, 1);
  g.strokeRoundedRect(x - 22, baseY - 44, 44, 44, 3);
  g.lineBetween(x - 22, baseY - 22, x + 22, baseY - 22);
  g.lineBetween(x, baseY - 44, x, baseY);
}

function drawBarrel(g, x) {
  const baseY = GROUND_TOP;
  g.fillStyle(0x5b3a21, 1);
  g.fillRoundedRect(x - 18, baseY - 50, 36, 50, 8);
  g.fillStyle(0x3a2616, 1);
  g.fillRect(x - 18, baseY - 40, 36, 5);
  g.fillRect(x - 18, baseY - 18, 36, 5);
}

function drawForestTree(g, x) {
  const baseY = GROUND_TOP;
  g.fillStyle(0x241a12, 1);
  g.fillRoundedRect(x - 8, baseY - 90, 16, 92, 4);
  g.fillStyle(0x16301e, 1);
  g.fillCircle(x, baseY - 116, 40);
  g.fillStyle(0x1e3a26, 1);
  g.fillCircle(x - 26, baseY - 100, 30);
  g.fillCircle(x + 26, baseY - 100, 30);
  g.fillStyle(0x24452e, 1);
  g.fillCircle(x, baseY - 100, 32);
}

function drawForestGate(g, x) {
  const baseY = GROUND_TOP;
  g.fillStyle(0x3a3640, 1);
  g.fillRoundedRect(x - 90, baseY - 180, 26, 180, 4);
  g.fillRoundedRect(x + 64, baseY - 180, 26, 180, 4);
  g.fillStyle(0x33303a, 1);
  g.fillRoundedRect(x - 96, baseY - 200, 192, 28, 6);
  g.fillStyle(0x0a0c0a, 1);
  g.fillRect(x - 64, baseY - 172, 128, 172);
  // wooden barricade (locked)
  g.fillStyle(0x5b3a21, 1);
  for (let i = 0; i < 4; i++) g.fillRoundedRect(x - 70, baseY - 150 + i * 38, 140, 22, 4);
  g.fillStyle(0x4a3018, 1);
  g.fillRect(x - 40, baseY - 160, 14, 160);
  g.fillRect(x + 26, baseY - 160, 14, 160);
  // chain + lock
  g.fillStyle(0x6b6b6b, 1);
  g.fillRect(x - 3, baseY - 92, 6, 12);
  g.fillStyle(0x9a9a9a, 1);
  g.fillCircle(x, baseY - 80, 12);
  g.fillStyle(0x0a0c0a, 1);
  g.fillCircle(x, baseY - 80, 5);
}

/* ---------- Area builders. Each draws one area's visuals and registers
 *            every created object with the AreaManager so it can be torn
 *            down on the next transition. ---------- */

function buildVillageArea(scene, am) {
  const T = (o) => am.track(o);
  const W = am.width;

  const sky = T(scene.add.graphics());
  sky.fillGradientStyle(0x8fb8e0, 0x8fb8e0, 0xe6d6c0, 0xf0e2cf, 1);
  sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  sky.setScrollFactor(0);

  T(scene.add.circle(740, 120, 46, 0xfff3d0, 0.9)).setScrollFactor(0.05);
  T(scene.add.circle(740, 120, 76, 0xfff3d0, 0.12)).setScrollFactor(0.05);

  const far = T(scene.add.graphics());
  far.fillStyle(0x8aa6a0, 1);
  for (let x = -200; x < W + 400; x += 360) far.fillEllipse(x, 470, 460, 300);
  far.setScrollFactor(0.25);

  const near = T(scene.add.graphics());
  near.fillStyle(0x6f9a6a, 1);
  for (let x = -100; x < W + 400; x += 300) near.fillEllipse(x, 500, 420, 280);
  near.setScrollFactor(0.45);

  for (let i = 0; i < Math.ceil(W / 360) + 2; i++) {
    const cx = 150 + i * 360;
    const cloud = T(scene.add.graphics());
    cloud.fillStyle(0xffffff, 0.75);
    cloud.fillEllipse(cx, 90 + (i % 3) * 26, 120, 40);
    cloud.fillEllipse(cx + 40, 100 + (i % 3) * 26, 90, 34);
    cloud.fillEllipse(cx - 40, 100 + (i % 3) * 26, 90, 34);
    cloud.setScrollFactor(0.15);
  }

  const g = T(scene.add.graphics());
  g.fillStyle(0x57a05a, 1);
  g.fillRect(0, GROUND_TOP, W, 14);
  g.fillStyle(0x3f7d44, 1);
  g.fillRect(0, GROUND_TOP + 14, W, GAME_HEIGHT);
  g.fillStyle(0xb89a6a, 1);
  g.fillRect(0, GROUND_TOP + 22, W, 26);
  g.fillStyle(0xa6885a, 1);
  for (let x = 10; x < W; x += 70) g.fillRoundedRect(x, GROUND_TOP + 28, 44, 12, 5);
  g.fillStyle(0x6cc06f, 1);
  for (let x = 20; x < W; x += 48) {
    const h = 6 + ((x * 7) % 6);
    g.fillTriangle(x, GROUND_TOP, x + 4, GROUND_TOP - h, x + 8, GROUND_TOP);
  }

  const back = T(scene.add.graphics());
  drawHouse(back, 360, GROUND_TOP, 0xe3cda0, 0x9c4f3c);
  drawHouse(back, 760, GROUND_TOP, 0xd6c6e0, 0x5a6b9c);
  drawHouse(back, 1500, GROUND_TOP, 0xcfe0c6, 0x4f7d52);
  drawHouse(back, 2050, GROUND_TOP, 0xe3cda0, 0x9c6b3c);
  drawHouse(back, 2700, GROUND_TOP, 0xd6c6e0, 0x6b5a9c);

  const front = T(scene.add.graphics());
  [180, 600, 1080, 1300, 1780, 2300, 2520, 2980].forEach((x) => drawTree(front, x, GROUND_TOP));
  [480, 940, 1640, 2180, 2840].forEach((x) => {
    const glow = drawLantern(front, x, GROUND_TOP);
    T(scene.add.circle(glow.x, glow.y, 26, 0xffd98a, 0.18));
    T(scene.add.circle(glow.x, glow.y, 14, 0xffe6a8, 0.28));
  });
}

function buildElderArea(scene, am) {
  const T = (o) => am.track(o);
  const W = am.width;

  const wall = T(scene.add.graphics());
  wall.fillGradientStyle(0x4a3326, 0x4a3326, 0x2a1d16, 0x21160f, 1);
  wall.fillRect(0, 0, W, GROUND_TOP + 8);
  wall.lineStyle(1, 0x000000, 0.12);
  for (let x = 0; x < W; x += 70) wall.lineBetween(x, 0, x, GROUND_TOP);
  wall.fillStyle(0x6b4a2e, 1);
  wall.fillRect(0, 118, W, 8);

  const floor = T(scene.add.graphics());
  floor.fillStyle(0x5a4030, 1);
  floor.fillRect(0, GROUND_TOP, W, GAME_HEIGHT - GROUND_TOP);
  floor.fillStyle(0x4a3526, 1);
  for (let x = 0; x < W; x += 60) floor.fillRect(x, GROUND_TOP, 2, GAME_HEIGHT - GROUND_TOP);
  floor.fillStyle(0x7a2f3a, 1);
  floor.fillRoundedRect(W / 2 - 200, GROUND_TOP + 6, 400, 12, 6);
  floor.fillStyle(0x9c3f4c, 1);
  floor.fillRoundedRect(W / 2 - 200, GROUND_TOP + 6, 400, 4, 4);

  [220, 560, 940, 1180].forEach((x, i) => drawBanner(T(scene.add.graphics()), x, i));
  [120, 1160].forEach((x) => drawBookshelf(T(scene.add.graphics()), x));
  [430, 780].forEach((x) => drawPortrait(T(scene.add.graphics()), x));

  [330, 650, 1010].forEach((x) => {
    drawCandleStand(T(scene.add.graphics()), x);
    const glow = T(scene.add.circle(x, GROUND_TOP - 168, 34, 0xffcf7a, 0.12));
    const flame = T(scene.add.circle(x, GROUND_TOP - 168, 4, 0xffe6a8, 0.9));
    scene.tweens.add({
      targets: [glow, flame],
      alpha: 0.5,
      scaleX: 0.85,
      scaleY: 0.85,
      duration: 130 + (x % 90),
      yoyo: true,
      repeat: -1,
    });
  });

  const vig = T(scene.add.graphics());
  vig.fillStyle(0x140d08, 0.28);
  vig.fillRect(0, 0, GAME_WIDTH, 56);
  vig.setScrollFactor(0);
}

function buildBlacksmithArea(scene, am) {
  const T = (o) => am.track(o);
  const W = am.width;

  const wall = T(scene.add.graphics());
  wall.fillGradientStyle(0x33303a, 0x33303a, 0x232029, 0x1b1820, 1);
  wall.fillRect(0, 0, W, GROUND_TOP + 8);
  wall.lineStyle(1, 0x000000, 0.18);
  for (let y = 40; y < GROUND_TOP; y += 46) {
    wall.lineBetween(0, y, W, y);
    for (let x = (Math.floor(y / 46) % 2) * 60; x < W; x += 120) wall.lineBetween(x, y, x, y + 46);
  }

  const floor = T(scene.add.graphics());
  floor.fillStyle(0x2f2b33, 1);
  floor.fillRect(0, GROUND_TOP, W, GAME_HEIGHT - GROUND_TOP);
  floor.fillStyle(0x26222a, 1);
  for (let x = 0; x < W; x += 44) floor.fillRect(x, GROUND_TOP + 8, 40, 4);

  // Forge with a flickering fire and rising smoke.
  const fx = 1230;
  drawForge(T(scene.add.graphics()), fx);
  const fglow = T(scene.add.circle(fx, GROUND_TOP - 64, 60, 0xff8a3a, 0.2));
  const fcore = T(scene.add.circle(fx, GROUND_TOP - 58, 22, 0xffd06a, 0.85));
  scene.tweens.add({ targets: fglow, alpha: 0.34, duration: 150, yoyo: true, repeat: -1 });
  scene.tweens.add({
    targets: fcore,
    alpha: 0.55,
    scaleX: 0.9,
    scaleY: 0.9,
    duration: 140,
    yoyo: true,
    repeat: -1,
  });
  for (let i = 0; i < 3; i++) {
    const sm = T(scene.add.circle(fx - 4 + i * 4, GROUND_TOP - 150, 12 - i * 2, 0x9a9a9a, 0.22));
    scene.tweens.add({
      targets: sm,
      y: GROUND_TOP - 250,
      alpha: 0,
      scaleX: 1.8,
      scaleY: 1.8,
      duration: 2200,
      delay: i * 700,
      repeat: -1,
    });
  }

  drawAnvil(T(scene.add.graphics()), 820);
  drawWeaponRack(T(scene.add.graphics()), 540);
  drawCrate(T(scene.add.graphics()), 300);
  drawCrate(T(scene.add.graphics()), 360);
  drawBarrel(T(scene.add.graphics()), 700);

  const amb = T(scene.add.graphics());
  amb.fillStyle(0xff8a3a, 0.05);
  amb.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  amb.setScrollFactor(0);
}

function buildForestGateArea(scene, am) {
  const T = (o) => am.track(o);
  const W = am.width;

  const sky = T(scene.add.graphics());
  sky.fillGradientStyle(0x1b2740, 0x222b48, 0x2a3340, 0x141a22, 1);
  sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  sky.setScrollFactor(0);

  T(scene.add.circle(220, 110, 34, 0xdfe6f0, 0.9)).setScrollFactor(0.05);
  T(scene.add.circle(220, 110, 54, 0xdfe6f0, 0.1)).setScrollFactor(0.05);

  const hills = T(scene.add.graphics());
  hills.fillStyle(0x162033, 1);
  for (let x = -100; x < W + 200; x += 260) hills.fillEllipse(x, 500, 360, 260);
  hills.setScrollFactor(0.3);

  const g = T(scene.add.graphics());
  g.fillStyle(0x243524, 1);
  g.fillRect(0, GROUND_TOP, W, 14);
  g.fillStyle(0x16210f, 1);
  g.fillRect(0, GROUND_TOP + 14, W, GAME_HEIGHT);
  g.fillStyle(0x2e1f12, 1);
  g.fillRect(0, GROUND_TOP + 22, W, 26);

  const trees = T(scene.add.graphics());
  [120, 300, 520, 760, 980, 1180].forEach((x) => drawForestTree(trees, x));

  // Drifting fog layers.
  for (let i = 0; i < 4; i++) {
    const fxp = 200 + i * 340;
    const fog = T(scene.add.graphics());
    fog.fillStyle(0xb9c4cc, 0.07);
    fog.fillEllipse(fxp, GROUND_TOP - 30, 360, 90);
    scene.tweens.add({
      targets: fog,
      x: 40,
      duration: 5200 + i * 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
  }

  // The sealed gate + warning sign.
  drawForestGate(T(scene.add.graphics()), 1360);
  drawSignpost(T(scene.add.graphics()), 1150, GROUND_TOP);
  T(
    scene.add
      .text(1150, GROUND_TOP - 96, "DANGER", {
        fontFamily: "Georgia, serif",
        fontSize: "15px",
        color: "#e0564a",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
  );
  T(
    scene.add
      .text(1150, GROUND_TOP - 80, "Forest path sealed", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "11px",
        color: "#d8c0a0",
      })
      .setOrigin(0.5)
  );

  // Faint glowing eyes deep in the dark - a hint of what waits in Stage 4.
  const e1 = T(scene.add.circle(1400, GROUND_TOP - 70, 3, 0xff5a4a, 0));
  const e2 = T(scene.add.circle(1412, GROUND_TOP - 70, 3, 0xff5a4a, 0));
  scene.tweens.add({
    targets: [e1, e2],
    alpha: 0.7,
    duration: 1400,
    yoyo: true,
    repeat: -1,
    ease: "Sine.inOut",
    delay: 600,
  });
}

/* ================================================================== *
 *  STAGE 4 SYSTEMS
 *  Forest combat, enemies, the Broken Memory Crystal, the Memory Shrine,
 *  and the Memory Spirit. Enemies and the crystal are data-driven (defined
 *  on the area, spawned by AreaManager) just like NPCs and transitions.
 * ================================================================== */

/* ---------- enemy / spirit / crystal textures ---------- */

function makeShadowSlime(scene, key) {
  const W = 46;
  const H = 36;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0x241a33, 1);
  g.fillEllipse(W / 2, H - 10, 42, 28);
  g.fillStyle(0x3a2a52, 1);
  g.fillEllipse(W / 2, H - 12, 42, 24);
  g.fillStyle(0x241a33, 1);
  g.fillCircle(9, H - 6, 6);
  g.fillCircle(37, H - 6, 6);
  g.fillStyle(0x8fe0ff, 1); // glowing eyes
  g.fillCircle(W / 2 - 7, H - 17, 3.4);
  g.fillCircle(W / 2 + 7, H - 17, 3.4);
  g.fillStyle(0xffffff, 0.85);
  g.fillCircle(W / 2 - 8, H - 18, 1.2);
  g.fillCircle(W / 2 + 6, H - 18, 1.2);
  g.generateTexture(key, W, H);
  g.destroy();
}

function makeMemoryBat(scene, key) {
  const W = 48;
  const H = 30;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0x1e1530, 1); // wings
  g.fillTriangle(24, 16, 2, 4, 7, 22);
  g.fillTriangle(24, 16, 46, 4, 41, 22);
  g.fillStyle(0x33264e, 1);
  g.fillTriangle(24, 16, 6, 12, 9, 21);
  g.fillTriangle(24, 16, 42, 12, 39, 21);
  g.fillStyle(0x3a2a52, 1); // body
  g.fillEllipse(24, 17, 14, 16);
  g.fillTriangle(19, 9, 21, 3, 24, 9); // ears
  g.fillTriangle(29, 9, 27, 3, 24, 9);
  g.fillStyle(0xff7a9a, 1); // eyes
  g.fillCircle(21, 16, 2.3);
  g.fillCircle(27, 16, 2.3);
  g.generateTexture(key, W, H);
  g.destroy();
}

function makeLostKnight(scene, key) {
  const W = 64;
  const H = 94;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0x1a1822, 1); // legs
  g.fillRoundedRect(23, 70, 8, 22, 3);
  g.fillRoundedRect(34, 70, 8, 22, 3);
  g.fillStyle(0x23202e, 1); // torso / cloak
  g.fillRoundedRect(19, 30, 26, 48, 6);
  g.fillStyle(0x2e2a3a, 1);
  g.fillRoundedRect(19, 30, 13, 48, 6);
  g.fillStyle(0x3a3548, 1); // pauldrons
  g.fillCircle(20, 34, 8);
  g.fillCircle(44, 34, 8);
  // sword arm + blade
  g.fillStyle(0x2a2636, 1);
  g.fillRoundedRect(44, 38, 6, 24, 3);
  g.fillStyle(0x3a2a1e, 1);
  g.fillRect(46, 60, 12, 5);
  g.fillStyle(0x6a7080, 1);
  g.fillRect(50, 16, 4, 46);
  g.fillStyle(0x9aa0b0, 0.7);
  g.fillRect(50, 16, 2, 46);
  // helmet
  g.fillStyle(0x2e2a3a, 1);
  g.fillCircle(32, 20, 11);
  g.fillStyle(0x14121c, 1);
  g.fillRect(23, 18, 18, 6); // visor
  g.fillStyle(0xff5a4a, 1); // glowing eyes
  g.fillRect(27, 19, 4, 2.4);
  g.fillRect(36, 19, 4, 2.4);
  g.fillStyle(0x4a4458, 1); // crest
  g.fillRect(31, 7, 2, 8);
  g.generateTexture(key, W, H);
  g.destroy();
}

function makeMemorySpirit(scene, key) {
  const W = 72;
  const H = 112;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  // flowing translucent robe
  g.fillStyle(0x6fc7e0, 0.42);
  g.fillPoints(
    [
      { x: 18, y: 30 },
      { x: 54, y: 30 },
      { x: 64, y: 104 },
      { x: 50, y: 98 },
      { x: 36, y: 108 },
      { x: 22, y: 98 },
      { x: 8, y: 104 },
    ],
    true
  );
  g.fillStyle(0xaef0f5, 0.5);
  g.fillPoints(
    [
      { x: 27, y: 30 },
      { x: 45, y: 30 },
      { x: 48, y: 98 },
      { x: 24, y: 98 },
    ],
    true
  );
  // hood / head
  g.fillStyle(0x9fe6ef, 0.62);
  g.fillCircle(36, 22, 15);
  g.fillStyle(0x0c1c22, 0.5);
  g.fillEllipse(36, 24, 18, 22);
  g.fillStyle(0xffffff, 0.95); // glowing eyes
  g.fillCircle(31, 22, 2.4);
  g.fillCircle(41, 22, 2.4);
  g.generateTexture(key, W, H);
  g.destroy();
}

function makeCrystal(scene, key) {
  const W = 40;
  const H = 58;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const pts = [
    { x: 20, y: 2 },
    { x: 34, y: 22 },
    { x: 25, y: 56 },
    { x: 15, y: 56 },
    { x: 6, y: 22 },
  ];
  g.fillStyle(0x4aa0c8, 0.95);
  g.fillPoints(pts, true);
  g.fillStyle(0xaef0ff, 0.92); // left facet
  g.fillPoints([{ x: 20, y: 2 }, { x: 20, y: 56 }, { x: 6, y: 22 }], true);
  g.fillStyle(0x3a86b0, 0.92); // right facet
  g.fillPoints([{ x: 20, y: 2 }, { x: 20, y: 56 }, { x: 34, y: 22 }], true);
  g.lineStyle(1.5, 0x16323f, 0.8); // crack
  g.lineBetween(20, 8, 16, 30);
  g.lineBetween(16, 30, 22, 46);
  g.fillStyle(0xffffff, 0.7);
  g.fillCircle(16, 16, 2);
  g.generateTexture(key, W, H);
  g.destroy();
}

/*
 * Enemy: a simple side-scrolling foe. Ground types (slime, knight) patrol
 * between two x bounds under gravity; flying types (bat) hover on a sine
 * path with gravity disabled. Enemies have HP, flash white when hit, are
 * knocked back briefly, and burst into particles when defeated.
 */
class Enemy {
  constructor(scene, def) {
    this.scene = scene;
    this.type = def.type;
    this.maxHP = def.hp;
    this.hp = def.hp;
    this.touchDamage = def.damage;
    this.speed = def.speed;
    this.flying = def.type === "bat";

    const sp = scene.physics.add.sprite(def.x, GROUND_TOP - 60, def.texture);
    scene.enemyGroup.add(sp);
    sp.setDepth(8);
    this.sprite = sp;

    if (this.flying) {
      sp.body.setAllowGravity(false);
      this.baseY = def.baseY || GROUND_TOP - 150;
      this.amp = def.amp || 40;
      sp.y = this.baseY;
      this.min = def.range ? def.range[0] : def.x - 120;
      this.max = def.range ? def.range[1] : def.x + 120;
    } else {
      sp.y = GROUND_TOP - sp.height / 2;
      this.min = def.patrol ? def.patrol[0] : def.x - 120;
      this.max = def.patrol ? def.patrol[1] : def.x + 120;
    }
    sp.body.setSize(sp.width * 0.7, sp.height * 0.82, true);

    this.dir = -1;
    this.alive = true;
    this.knockUntil = 0;
    this.t = Math.random() * 1000;
  }

  get x() {
    return this.sprite && this.sprite.active ? this.sprite.x : -99999;
  }

  update() {
    if (!this.alive || !this.sprite.active) return;
    const sp = this.sprite;
    const now = this.scene.time.now;
    if (now < this.knockUntil) return; // let the knockback play out

    if (sp.x <= this.min) this.dir = 1;
    else if (sp.x >= this.max) this.dir = -1;
    sp.setVelocityX(this.dir * this.speed);
    sp.setFlipX(this.dir > 0);

    if (this.flying) {
      this.t += 16;
      sp.setVelocityY(0);
      sp.y = this.baseY + Math.sin(this.t / 280) * this.amp;
    }
  }

  freeze() {
    if (this.alive && this.sprite.active && this.sprite.body) this.sprite.setVelocity(0, 0);
  }

  hit(dmg, fromX) {
    if (!this.alive || !this.sprite.active) return;
    this.hp -= dmg;
    const sp = this.sprite;
    sp.setTintFill(0xffffff);
    this.scene.time.delayedCall(90, () => {
      if (sp.active) sp.clearTint();
    });
    const kdir = sp.x < fromX ? -1 : 1;
    sp.setVelocityX(kdir * 230);
    if (!this.flying) sp.setVelocityY(-170);
    this.knockUntil = this.scene.time.now + 180;
    sfx.hit();
    if (this.hp <= 0) this.die();
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.scene.spawnDefeatEffect(this.sprite.x, this.sprite.y, this.type);
    sfx.defeat();
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.destroy();
  }

  destroy() {
    this.alive = false;
    if (this.sprite && this.sprite.active) {
      this.scene.tweens.killTweensOf(this.sprite);
      this.sprite.destroy();
    }
  }
}

/*
 * Pickup: a collectible story object (the Broken Memory Crystal). It floats
 * with a soft glow and is collected by pressing E nearby. Collection logic
 * lives in the scene so it can update quests and unlock the shrine.
 */
class Pickup {
  constructor(scene, def) {
    this.scene = scene;
    this.id = def.id;
    this.name = def.name;
    this.x = def.x;
    const y = GROUND_TOP - 44;
    this.glow = scene.add.circle(def.x, y, 22, 0x8fe0ff, 0.22).setDepth(7);
    this.sprite = scene.add.sprite(def.x, y, def.texture).setDepth(8);
    scene.tweens.add({
      targets: [this.sprite, this.glow],
      y: y - 8,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
    scene.tweens.add({
      targets: this.glow,
      alpha: 0.45,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 900,
      yoyo: true,
      repeat: -1,
    });
  }

  destroy() {
    this.scene.tweens.killTweensOf(this.sprite);
    this.scene.tweens.killTweensOf(this.glow);
    this.sprite.destroy();
    this.glow.destroy();
  }
}

/* ---------- Stage 4 scenery drawing helpers ---------- */

function drawRock(g, x, s) {
  const baseY = GROUND_TOP;
  g.fillStyle(0x2a2a33, 1);
  g.fillEllipse(x, baseY - 6, 54 * s, 30 * s);
  g.fillStyle(0x34343f, 1);
  g.fillEllipse(x - 8, baseY - 14, 34 * s, 22 * s);
  g.fillStyle(0x3f3f4a, 0.6);
  g.fillEllipse(x - 12, baseY - 18, 14 * s, 9 * s);
}

function drawBrokenSign(g, x) {
  const baseY = GROUND_TOP;
  g.fillStyle(0x3a2818, 1);
  g.fillRect(x - 3, baseY - 64, 6, 64);
  g.fillStyle(0x5b3f28, 1);
  g.fillRoundedRect(x - 30, baseY - 92, 60, 26, 4);
  // a snapped-off corner (painted with the forest ground tone)
  g.fillStyle(0x0e160e, 1);
  g.fillTriangle(x + 30, baseY - 92, x + 30, baseY - 78, x + 8, baseY - 66);
  g.lineStyle(2, 0x2a1c10, 1);
  g.strokeRoundedRect(x - 30, baseY - 92, 60, 26, 4);
  g.lineStyle(1, 0x2a1c10, 0.8);
  g.lineBetween(x - 18, baseY - 86, x + 12, baseY - 72);
}

function drawShrineCrystal(g, x, y) {
  g.fillStyle(0x6f5fd0, 0.92);
  g.fillPoints(
    [
      { x: x, y: y - 90 },
      { x: x + 34, y: y },
      { x: x + 16, y: y + 80 },
      { x: x - 16, y: y + 80 },
      { x: x - 34, y: y },
    ],
    true
  );
  g.fillStyle(0xaf9fff, 0.85);
  g.fillPoints([{ x: x, y: y - 90 }, { x: x, y: y + 80 }, { x: x - 34, y: y }], true);
  g.fillStyle(0x4a3aa0, 0.85);
  g.fillPoints([{ x: x, y: y - 90 }, { x: x, y: y + 80 }, { x: x + 34, y: y }], true);
  g.fillStyle(0xffffff, 0.5);
  g.fillPoints([{ x: x, y: y - 90 }, { x: x - 10, y: y - 30 }, { x: x + 8, y: y - 34 }], true);
}

// Spawns a field of slow, glowing "memory" motes that drift upward and pulse.
// Everything is registered with the AreaManager so it is cleaned up on exit.
function addMemoryParticles(scene, am, opts) {
  for (let i = 0; i < opts.count; i++) {
    const x = Phaser.Math.Between(40, opts.w - 40);
    const y = Phaser.Math.Between(opts.yTop, opts.yBot);
    const r = Phaser.Math.FloatBetween(1.5, 3.5);
    const dot = am.track(scene.add.circle(x, y, r, opts.color, 0));
    const glow = am.track(scene.add.circle(x, y, r * 2.4, opts.color, 0));
    const target = Phaser.Math.FloatBetween(0.35, 0.8);
    scene.tweens.add({
      targets: [dot, glow],
      alpha: target,
      duration: Phaser.Math.Between(800, 1600),
      yoyo: true,
      repeat: -1,
      delay: Phaser.Math.Between(0, 1500),
    });
    scene.tweens.add({
      targets: [dot, glow],
      y: y - Phaser.Math.Between(20, 60),
      duration: Phaser.Math.Between(2600, 4200),
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
  }
}

/* ---------- Stage 4 area builders ---------- */

function buildForestArea(scene, am) {
  const T = (o) => am.track(o);
  const W = am.width;

  const sky = T(scene.add.graphics());
  sky.fillGradientStyle(0x0d1320, 0x121a2e, 0x14202a, 0x0a0f16, 1);
  sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  sky.setScrollFactor(0);

  T(scene.add.circle(160, 90, 26, 0xc8d4e0, 0.5)).setScrollFactor(0.05);
  T(scene.add.circle(160, 90, 46, 0xc8d4e0, 0.08)).setScrollFactor(0.05);

  // Parallax tree silhouettes.
  const far = T(scene.add.graphics());
  far.fillStyle(0x0c1a14, 1);
  for (let x = -50; x < W + 200; x += 150) far.fillTriangle(x, 470, x + 40, 300 + (x % 60), x + 80, 470);
  far.setScrollFactor(0.25);
  const mid = T(scene.add.graphics());
  mid.fillStyle(0x0f2418, 1);
  for (let x = -40; x < W + 200; x += 120) mid.fillTriangle(x, 490, x + 50, 330, x + 100, 490);
  mid.setScrollFactor(0.45);

  const g = T(scene.add.graphics());
  g.fillStyle(0x1a2a1a, 1);
  g.fillRect(0, GROUND_TOP, W, 14);
  g.fillStyle(0x0e160e, 1);
  g.fillRect(0, GROUND_TOP + 14, W, GAME_HEIGHT);
  g.fillStyle(0x20160e, 1);
  g.fillRect(0, GROUND_TOP + 22, W, 26);

  const trees = T(scene.add.graphics());
  [80, 240, 420, 640, 860, 1120, 1360, 1600, 1860, 2080, 2320, 2560].forEach((x) =>
    drawForestTree(trees, x)
  );

  [360, 980, 1500, 2200].forEach((x) => drawRock(T(scene.add.graphics()), x, 1));
  drawBrokenSign(T(scene.add.graphics()), 500);
  drawBrokenSign(T(scene.add.graphics()), 1700);

  for (let i = 0; i < 5; i++) {
    const fxp = 200 + i * 460;
    const fog = T(scene.add.graphics());
    fog.fillStyle(0x9ab0c0, 0.06);
    fog.fillEllipse(fxp, GROUND_TOP - 26, 420, 100);
    scene.tweens.add({ targets: fog, x: 50, duration: 6000 + i * 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
  }

  addMemoryParticles(scene, am, { count: 26, color: 0x8fe0ff, w: W, yTop: 160, yBot: GROUND_TOP - 30 });

  const vig = T(scene.add.graphics());
  vig.fillStyle(0x000000, 0.25);
  vig.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  vig.setScrollFactor(0);
}

function buildShrineArea(scene, am) {
  const T = (o) => am.track(o);
  const W = am.width;
  const cx = 820;

  const sky = T(scene.add.graphics());
  sky.fillGradientStyle(0x130a26, 0x1a0f33, 0x0e0820, 0x07040f, 1);
  sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  sky.setScrollFactor(0);

  T(scene.add.circle(cx * 0.6, 200, 160, 0x4a2f8a, 0.1)).setScrollFactor(0.3);

  const back = T(scene.add.graphics());
  back.fillStyle(0x1c1430, 1);
  for (let x = 120; x < W; x += 260) back.fillRoundedRect(x - 22, 200, 44, GROUND_TOP - 200, 6);
  back.setScrollFactor(0.4);

  const g = T(scene.add.graphics());
  g.fillStyle(0x2a2140, 1);
  g.fillRect(0, GROUND_TOP, W, GAME_HEIGHT - GROUND_TOP);
  g.fillStyle(0x221a36, 1);
  for (let x = 0; x < W; x += 58) g.fillRect(x, GROUND_TOP, 2, GAME_HEIGHT - GROUND_TOP);
  g.fillStyle(0x3a2f58, 1);
  g.fillRoundedRect(cx - 200, GROUND_TOP - 14, 400, 16, 6);
  g.fillStyle(0x4a3d6e, 1);
  g.fillRoundedRect(cx - 200, GROUND_TOP - 14, 400, 5, 4);
  [cx - 230, cx + 230].forEach((px) => {
    g.fillStyle(0x2e2548, 1);
    g.fillRoundedRect(px - 16, GROUND_TOP - 150, 32, 150, 5);
    g.fillStyle(0x3a2f58, 1);
    g.fillRoundedRect(px - 20, GROUND_TOP - 160, 40, 16, 4);
  });

  drawShrineCrystal(T(scene.add.graphics()), cx, GROUND_TOP - 150);
  const cg1 = T(scene.add.circle(cx, GROUND_TOP - 150, 70, 0x8f6fff, 0.12));
  const cg2 = T(scene.add.circle(cx, GROUND_TOP - 150, 40, 0xb89fff, 0.18));
  scene.tweens.add({ targets: [cg1, cg2], alpha: 0.32, scaleX: 1.1, scaleY: 1.1, duration: 1400, yoyo: true, repeat: -1 });
  const sg = T(scene.add.circle(cx, GROUND_TOP - 60, 46, 0x8fe0ff, 0.12));
  scene.tweens.add({ targets: sg, alpha: 0.3, duration: 1200, yoyo: true, repeat: -1 });

  addMemoryParticles(scene, am, { count: 34, color: 0xb89fff, w: W, yTop: 120, yBot: GROUND_TOP - 20 });
  addMemoryParticles(scene, am, { count: 14, color: 0x8fe0ff, w: W, yTop: 200, yBot: GROUND_TOP - 20 });
}

/*
 * AREAS: the data describing every side-scrolling location, the NPCs that
 * live there, and the transitions (doors / paths) that connect them.
 * Layout is linear: Village <-> Elder's Hall, Village <-> Forge <-> Forest
 * Gate <-> Forest <-> Memory Shrine.
 */
const AREAS = {
  village: {
    name: "Willowmere Village",
    width: 3200,
    build: buildVillageArea,
    npcs: [
      {
        id: "mira",
        name: "Mira",
        x: 1180,
        texture: "mira_idle",
        animate: true,
        frames: ["mira_idle", "mira_walk1", "mira_idle", "mira_walk2"],
      },
    ],
    transitions: [
      { x: 360, range: 70, to: "elder", spawnX: 230, facing: 1, kind: "door", signText: "Elder's Hall", label: "Enter the Elder's Hall" },
      { x: 3120, range: 80, to: "blacksmith", spawnX: 240, facing: 1, kind: "sign", signText: "Blacksmith", label: "Go to the Blacksmith" },
    ],
  },
  elder: {
    name: "The Elder's Hall",
    width: 1300,
    build: buildElderArea,
    npcs: [{ id: "bram", name: "Elder Bram", x: 780, texture: "bram_idle", animate: false }],
    transitions: [
      { x: 150, range: 75, to: "village", spawnX: 430, facing: 1, kind: "door", signText: "Village", label: "Back to the Village" },
    ],
  },
  blacksmith: {
    name: "Doran's Forge",
    width: 1600,
    build: buildBlacksmithArea,
    npcs: [{ id: "doran", name: "Blacksmith Doran", x: 1000, texture: "doran_idle", animate: false, flip: true }],
    transitions: [
      { x: 120, range: 70, to: "village", spawnX: 3000, facing: -1, kind: "sign", signText: "Village", label: "Back to the Village" },
      { x: 1470, range: 80, to: "forest_gate", spawnX: 230, facing: 1, kind: "sign", signText: "Forest", label: "Go to the Forest Gate" },
    ],
  },
  forest_gate: {
    name: "The Forest Gate",
    width: 1440,
    build: buildForestGateArea,
    npcs: [],
    transitions: [
      { x: 110, range: 70, to: "blacksmith", spawnX: 1380, facing: -1, kind: "sign", signText: "Forge", label: "Back to the Forge" },
      {
        x: 1360,
        range: 95,
        to: "forest",
        spawnX: 120,
        facing: 1,
        kind: "sign",
        signText: "Enter",
        label: "Enter the Forest",
        requires: (s) => s.equipment.get("armor") === "leather_armor",
        lockedLabel: "The forest is too dangerous. Equip your armor first.",
      },
    ],
  },
  forest: {
    name: "The Whispering Forest",
    width: 2700,
    build: buildForestArea,
    npcs: [],
    enemies: [
      { type: "slime", texture: "shadow_slime", x: 600, hp: 6, damage: 6, speed: 55, patrol: [470, 770] },
      { type: "bat", texture: "memory_bat", x: 1000, hp: 4, damage: 5, speed: 85, range: [880, 1180], baseY: GROUND_TOP - 150, amp: 44 },
      { type: "slime", texture: "shadow_slime", x: 1450, hp: 6, damage: 6, speed: 60, patrol: [1320, 1600] },
      { type: "bat", texture: "memory_bat", x: 1800, hp: 4, damage: 5, speed: 95, range: [1680, 1960], baseY: GROUND_TOP - 175, amp: 52 },
      { type: "knight", texture: "lost_knight", x: 2160, hp: 18, damage: 10, speed: 44, patrol: [2020, 2280] },
    ],
    pickups: [
      { id: "crystal", name: "Broken Memory Crystal", texture: "crystal", x: 2420, flag: "crystalFound" },
    ],
    transitions: [
      { x: 70, range: 70, to: "forest_gate", spawnX: 1300, facing: -1, kind: "sign", signText: "Gate", label: "Back to the Forest Gate" },
      {
        x: 2600,
        range: 80,
        to: "shrine",
        spawnX: 150,
        facing: 1,
        kind: "door",
        signText: "Shrine",
        label: "Enter the Memory Shrine",
        requires: (s) => s.flags.crystalFound,
        lockedLabel: "A sealed light bars the way. Find the Broken Memory Crystal.",
      },
    ],
  },
  shrine: {
    name: "The Memory Shrine",
    width: 1500,
    build: buildShrineArea,
    npcs: [{ id: "spirit", name: "Memory Spirit", x: 820, texture: "spirit_idle", animate: false, yOffset: -16, alpha: 0.95 }],
    transitions: [
      { x: 70, range: 70, to: "forest", spawnX: 2520, facing: -1, kind: "door", signText: "Forest", label: "Back to the Forest" },
    ],
  },
};

/*
 * AreaManager: loads/unloads areas. It tracks every display object created
 * for the current area so it can destroy them (and their tweens) cleanly
 * when the player moves on. The player, camera, and UI are NOT touched.
 */
class AreaManager {
  constructor(scene) {
    this.scene = scene;
    this.defs = {};
    this.current = null;
    this.width = 0;
    this.objects = [];
    this.npcs = [];
    this.transitions = [];
    this.enemies = []; // Stage 4 combat foes
    this.pickups = []; // Stage 4 collectibles (the crystal)
  }

  register(defs) {
    this.defs = defs;
  }

  track(obj) {
    this.objects.push(obj);
    return obj;
  }

  clear() {
    const s = this.scene;
    this.objects.forEach((o) => {
      s.tweens.killTweensOf(o);
      o.destroy();
    });
    this.objects = [];
    this.npcs.forEach((n) => n.destroy());
    this.npcs = [];
    this.enemies.forEach((e) => e.destroy());
    this.enemies = [];
    this.pickups.forEach((p) => p.destroy());
    this.pickups = [];
    this.transitions = [];
  }

  load(key, spawnX, facing) {
    this.clear();
    const def = this.defs[key];
    this.current = key;
    this.width = def.width;

    const s = this.scene;
    s.physics.world.setBounds(0, 0, def.width, GAME_HEIGHT);
    s.cameras.main.setBounds(0, 0, def.width, GAME_HEIGHT);

    def.build(s, this);
    (def.npcs || []).forEach((nd) => this.npcs.push(new NPC(s, nd)));
    (def.enemies || []).forEach((ed) => this.enemies.push(new Enemy(s, ed)));
    // Skip a pickup the player has already collected (flag persists on scene).
    (def.pickups || []).forEach((pd) => {
      if (pd.flag && s.flags[pd.flag]) return;
      this.pickups.push(new Pickup(s, pd));
    });
    (def.transitions || []).forEach((td) => this.addTransition(td));

    s.placePlayer(spawnX, facing);
    s.showAreaTitle(def.name);
  }

  // Draws a transition marker (door or signpost) and stores its trigger zone.
  addTransition(def) {
    const s = this.scene;
    const baseY = GROUND_TOP;
    const g = this.track(s.add.graphics());
    g.fillStyle(0xffe6a8, 0.05);
    g.fillRect(def.x - 22, 150, 44, baseY - 150);

    let labelY;
    let arrowY;
    if (def.kind === "door") {
      drawDoorway(g, def.x, baseY);
      labelY = baseY - 134;
      arrowY = baseY - 158;
    } else {
      drawSignpost(g, def.x, baseY);
      labelY = baseY - 92;
      arrowY = baseY - 128;
    }

    if (def.signText) {
      this.track(
        s.add
          .text(def.x, labelY, def.signText, {
            fontFamily: "Georgia, serif",
            fontSize: "13px",
            color: "#f4ec99",
          })
          .setOrigin(0.5)
      );
    }

    const arrow = this.track(
      s.add.text(def.x, arrowY, "\u25B2", { fontFamily: "sans-serif", fontSize: "18px", color: "#ffe08a" }).setOrigin(0.5)
    );
    s.tweens.add({ targets: arrow, y: arrowY - 7, alpha: 0.35, yoyo: true, repeat: -1, duration: 760, ease: "Sine.inOut" });

    this.transitions.push({
      x: def.x,
      range: def.range || 80,
      to: def.to,
      spawnX: def.spawnX,
      facing: def.facing || 1,
      label: def.label,
      requires: def.requires || null, // optional gate, e.g. crystal collected
      lockedLabel: def.lockedLabel || def.label,
    });
  }
}

/* ------------------------------------------------------------------ *
 *  Title scene
 * ------------------------------------------------------------------ */

class TitleScene extends Phaser.Scene {
  constructor() {
    super("Title");
  }

  create() {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x243b6b, 0x243b6b, 0x6f7fb0, 0x9fb0d8, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // distant scenery silhouette
    drawHill(bg, 180, 470, 520, 260, 0x4f6a86);
    drawHill(bg, 620, 500, 620, 300, 0x415a74);
    drawHill(bg, 960, 470, 520, 260, 0x4f6a86);
    bg.fillStyle(0x2e4a3a, 1);
    bg.fillRect(0, 452, GAME_WIDTH, GAME_HEIGHT - 452);

    drawTree(bg, 130, 470);
    drawHouse(bg, 470, 470, 0xd8c39a, 0x8c4a3a);
    drawTree(bg, 820, 470);

    // A calm moon glow.
    const moon = this.add.circle(800, 110, 40, 0xfdf6d8, 0.95);
    moon.setAlpha(0.95);
    this.add.circle(800, 110, 64, 0xfdf6d8, 0.12);

    // Hero standing on the title screen (uses the real player sprite).
    const hero = this.add.sprite(180, 452, "player_idle").setOrigin(0.5, 1);
    hero.setScale(1.6);
    this.tweens.add({
      targets: hero,
      y: hero.y - 4,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });

    // Title text.
    const title = this.add
      .text(GAME_WIDTH / 2, 150, "The Village That Forgot", {
        fontFamily: "Georgia, 'Trebuchet MS', serif",
        fontSize: "54px",
        color: "#fdf3d6",
        stroke: "#241733",
        strokeThickness: 8,
        align: "center",
      })
      .setOrigin(0.5);
    title.setShadow(0, 6, "rgba(0,0,0,0.5)", 8);

    this.add
      .text(GAME_WIDTH / 2, 206, "A side-scrolling mystery", {
        fontFamily: "Georgia, serif",
        fontSize: "20px",
        color: "#e6d6ff",
      })
      .setOrigin(0.5);

    // Start Game button (a real, working button).
    const btnW = 240;
    const btnH = 64;
    const bx = GAME_WIDTH / 2;
    const by = 340;
    const btn = this.add.graphics();
    const drawButton = (hover) => {
      btn.clear();
      btn.fillStyle(0x241733, 1);
      btn.fillRoundedRect(bx - btnW / 2 - 4, by - btnH / 2 - 4, btnW + 8, btnH + 8, 16);
      btn.fillStyle(hover ? 0xe0b93a : 0xc9a227, 1);
      btn.fillRoundedRect(bx - btnW / 2, by - btnH / 2, btnW, btnH, 14);
      btn.fillStyle(0xffffff, hover ? 0.18 : 0.1);
      btn.fillRoundedRect(bx - btnW / 2, by - btnH / 2, btnW, btnH / 2, 14);
    };
    drawButton(false);

    const btnText = this.add
      .text(bx, by, "Start Game", {
        fontFamily: "Georgia, serif",
        fontSize: "26px",
        color: "#241733",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const hit = this.add
      .zone(bx, by, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerover", () => drawButton(true));
    hit.on("pointerout", () => drawButton(false));
    hit.on("pointerdown", () => this.startGame());

    this.add
      .text(GAME_WIDTH / 2, 420, "Press Enter or Space to begin", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "16px",
        color: "#b9a8d8",
      })
      .setOrigin(0.5);

    // Ignore key presses for a moment so an Enter/Space carried over from a
    // previous scene (e.g. the ending's "Play Again") cannot skip the title.
    this.started = false;
    this.ready = false;
    this.time.delayedCall(350, () => (this.ready = true));
    this.input.keyboard.on("keydown-ENTER", () => this.startGame());
    this.input.keyboard.on("keydown-SPACE", () => this.startGame());
  }

  startGame() {
    if (this.started || !this.ready) return;
    this.started = true;
    sfx._ensure(); // unlock Web Audio on this user gesture
    this.cameras.main.fadeOut(280, 12, 8, 20);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.start("Village");
    });
  }
}

/* ------------------------------------------------------------------ *
 *  Village scene (gameplay)
 * ------------------------------------------------------------------ */

class VillageScene extends Phaser.Scene {
  constructor() {
    super("Village");
  }

  create() {
    this.transitioning = false;
    this.dead = false;
    this.facing = 1;
    this.walkTimer = 0;
    this.walkFrame = 0;
    this.attackReadyAt = 0; // combat cooldown timestamp
    this.invincibleUntil = 0; // i-frames after taking a hit
    this.cameras.main.fadeIn(280, 12, 8, 20);

    // Persistent pieces that survive across every area.
    this.buildPlayer();
    this.buildInput();
    this.buildPrompt();
    this.buildAreaTitle();

    // ----- Persistent game systems -----
    this.playerData = new Player();
    this.inventory = new InventoryManager();
    this.equipment = new EquipmentManager(this.inventory);
    this.playerData.equipment = this.equipment;
    this.equipment.setInitial("weapon", "wooden_blade");
    this.equipment.setInitial("armor", "torn_clothes");

    this.notifications = new NotificationManager(this);
    this.quests = new QuestManager(this);
    this.dialogue = new DialogueManager(this);
    this.menu = new InventoryMenu(this);
    this.buildHUD(); // needs playerData, so built after the systems above

    // Linear story flags. The whole game is ONE path with ONE ending, so a
    // flat set of booleans is enough - no branching state to track.
    this.flags = {
      fragmentsStarted: false,
      swordGiven: false,
      fragmentsComplete: false,
      forestStarted: false,
      spokeToBram: false,
      armorGiven: false,
      armorEquipped: false,
      forestComplete: false,
      // Stage 4 (the final quest "Truth Restored").
      truthStarted: false,
      crystalFound: false,
      shrineReached: false,
      truthComplete: false,
    };
    this.storyItems = []; // non-equippable plot items (the crystal)

    // Mira's lines (she only partly remembers the player).
    this.miraIntroLines = [
      "Oh... a traveler. We do not get many of those anymore.",
      "You came back to Willowmere. I feel like I should know your face... but it slips away.",
      "People wake and cannot recall their own names. The well runs, but no one remembers digging it.",
      "I am Mira. I still remember most things. For now.",
      "Stay a while, traveler. Perhaps you can help us remember what we lost.",
    ];
    this.miraGiveLine =
      "I don't fully remember you... but this sword feels like it belonged to someone I trusted. Take it.";

    // Load the opening area; AreaManager handles every transition after this.
    this.area = new AreaManager(this);
    this.area.register(AREAS);
    this.area.load("village", 220, 1);
  }

  /* ---------- player (persistent across all areas) ---------- */
  buildPlayer() {
    this.player = this.physics.add.sprite(220, GROUND_TOP - 60, "player_idle");
    this.player.setOrigin(0.5, 0.5);
    this.player.body.setSize(20, 54);
    this.player.body.setOffset(22, 26);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);

    // A single invisible floor spans every area (all areas share GROUND_TOP),
    // so the ground collider never has to be rebuilt during a transition.
    this.groundBody = this.add.rectangle(
      3000,
      GROUND_TOP + (GAME_HEIGHT - GROUND_TOP) / 2,
      6000,
      GAME_HEIGHT - GROUND_TOP
    );
    this.groundBody.setVisible(false);
    this.physics.add.existing(this.groundBody, true);
    this.physics.add.collider(this.player, this.groundBody);

    // One physics group + collider for all enemies (created once; enemies are
    // added/removed per area without ever rebuilding the collider).
    this.enemyGroup = this.physics.add.group();
    this.physics.add.collider(this.enemyGroup, this.groundBody);

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setFollowOffset(0, 40);
  }

  /* ---------- input ---------- */
  buildInput() {
    const kb = this.input.keyboard;
    this.cursors = kb.createCursorKeys();
    this.keys = kb.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      jump: Phaser.Input.Keyboard.KeyCodes.SPACE,
      talk: Phaser.Input.Keyboard.KeyCodes.E,
      enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
      // Stage 2: menu + list navigation.
      menu: Phaser.Input.Keyboard.KeyCodes.I,
      esc: Phaser.Input.Keyboard.KeyCodes.ESC,
      navUp: Phaser.Input.Keyboard.KeyCodes.W,
      navDown: Phaser.Input.Keyboard.KeyCodes.S,
      // Stage 4: attack.
      attack: Phaser.Input.Keyboard.KeyCodes.J,
    });
  }

  /* ---------- HP bar HUD (always visible, bottom-left) ---------- */
  buildHUD() {
    this.hpBarG = this.add.graphics().setScrollFactor(0).setDepth(60);
    this.hpLabel = this.add
      .text(24, GAME_HEIGHT - 30, "HP", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "14px",
        color: "#c9a227",
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(61);
    this.hpText = this.add
      .text(0, 0, "", {
        fontFamily: "Consolas, 'Courier New', monospace",
        fontSize: "13px",
        color: "#f4ecff",
      })
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(61);
    this.updateHUD();
  }

  updateHUD() {
    const x = 58;
    const y = GAME_HEIGHT - 38;
    const w = 168;
    const h = 16;
    const pd = this.playerData;
    const ratio = Phaser.Math.Clamp(pd.hp / pd.maxHP, 0, 1);
    const g = this.hpBarG;
    g.clear();
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(x - 5, y - 5, w + 10, h + 10, 8);
    g.fillStyle(0x2a2233, 1);
    g.fillRoundedRect(x, y, w, h, 6);
    const col = ratio > 0.5 ? 0x6fbf73 : ratio > 0.25 ? 0xd8b54a : 0xcf4a4a;
    g.fillStyle(col, 1);
    g.fillRoundedRect(x, y, Math.max(2, w * ratio), h, 6);
    g.lineStyle(1, 0xc9a227, 0.8);
    g.strokeRoundedRect(x, y, w, h, 6);
    this.hpText.setText(pd.hp + " / " + pd.maxHP).setPosition(x + w - 8, y + h / 2);
  }

  /* ---------- interaction prompt (fixed UI, label set per target) ---------- */
  buildPrompt() {
    this.promptBox = this.add
      .container(GAME_WIDTH / 2, GAME_HEIGHT - 78)
      .setScrollFactor(0)
      .setDepth(50)
      .setAlpha(0);
    this.promptBg = this.add.graphics();
    this.promptKey = this.add.graphics();
    this.promptKeyText = this.add
      .text(0, 0, "E", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "18px",
        color: "#241733",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.promptLabel = this.add
      .text(0, 0, "", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "18px",
        color: "#f4ecff",
      })
      .setOrigin(0, 0.5);
    this.promptBox.add([this.promptBg, this.promptKey, this.promptKeyText, this.promptLabel]);
    this.promptVisible = false;
    this.currentPromptText = "";
  }

  // The label changes per target ("Talk to Mira", "Go to the Blacksmith", ...)
  // so the pill is redrawn to fit whatever text is shown.
  setPrompt(text) {
    if (text === this.currentPromptText) return;
    this.currentPromptText = text;
    this.promptLabel.setText(text);
    const tw = this.promptLabel.width;
    const padL = 54;
    const padR = 22;
    const h = 44;
    const w = padL + tw + padR;
    this.promptBg.clear();
    this.promptBg.fillStyle(0x1c1430, 0.9);
    this.promptBg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    this.promptBg.lineStyle(2, 0xc9a227, 0.9);
    this.promptBg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    this.promptKey.clear();
    this.promptKey.fillStyle(0xc9a227, 1);
    this.promptKey.fillRoundedRect(-w / 2 + 14, -14, 28, 28, 6);
    this.promptKeyText.setPosition(-w / 2 + 28, 0);
    this.promptLabel.setPosition(-w / 2 + padL, 0);
  }

  showPrompt(show) {
    if (show === this.promptVisible) return;
    this.promptVisible = show;
    this.tweens.add({
      targets: this.promptBox,
      alpha: show ? 1 : 0,
      duration: 160,
      ease: "Sine.out",
    });
  }

  /* ---------- area title flash ---------- */
  buildAreaTitle() {
    this.areaTitleText = this.add
      .text(GAME_WIDTH / 2, 96, "", {
        fontFamily: "Georgia, serif",
        fontSize: "30px",
        color: "#f7e7a8",
        stroke: "#241733",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(70)
      .setAlpha(0);
  }

  showAreaTitle(name) {
    this.tweens.killTweensOf(this.areaTitleText);
    this.areaTitleText.setText(name).setAlpha(0);
    this.areaTitleText.y = 86;
    this.tweens.add({
      targets: this.areaTitleText,
      alpha: 1,
      y: 96,
      duration: 300,
      ease: "Sine.out",
      hold: 1100,
      yoyo: true,
    });
  }

  /* ---------- area transitions ---------- */
  // Drop the player onto the ground at a logical spot after changing areas.
  placePlayer(x, facing) {
    this.player.setPosition(x, GROUND_TOP - 60);
    this.player.setVelocity(0, 0);
    this.facing = facing || 1;
    this.player.setFlipX(this.facing === -1);
    this.player.setTexture("player_idle");
    this.cameras.main.centerOn(x, GROUND_TOP - 60);
  }

  // Fade out, swap the area, fade back in. Input is locked while in flight.
  changeArea(t) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.showPrompt(false);
    this.player.setVelocity(0, 0);
    this.cameras.main.fadeOut(220, 8, 6, 16);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.area.load(t.to, t.spawnX, t.facing);
      this.cameras.main.fadeIn(220, 8, 6, 16);
      this.transitioning = false;
      this.onAreaEntered(t.to);
    });
  }

  // Fired right after a new area finishes loading (drives location-based
  // quest steps such as reaching the Forest Gate).
  onAreaEntered(key) {
    if (
      key === "forest_gate" &&
      this.flags.forestStarted &&
      this.equipment.get("armor") === "leather_armor" &&
      !this.flags.forestComplete
    ) {
      this.flags.armorEquipped = true;
      this.flags.forestComplete = true;
      this.quests.completeStep(4); // Reach the Forest Gate
      this.quests.markComplete();
      this.notifications.notify("Quest Complete: Into the Forest", 0x6fbf73);
    }

    // Entering the forest begins the final quest, "Truth Restored".
    if (key === "forest" && !this.flags.truthStarted) {
      this.flags.truthStarted = true;
      this.quests.startQuest("Truth Restored", [
        "Enter the forest",
        "Find the Broken Memory Crystal",
        "Reach the Memory Shrine",
        "Listen to the Memory Spirit",
        "Restore the village's memories",
      ]);
      this.quests.completeStep(0);
      this.notifications.notify("Quest Updated: Enter the Forest");
    }

    if (key === "shrine" && !this.flags.shrineReached) {
      this.flags.shrineReached = true;
      if (this.quests.active && this.quests.active.name === "Truth Restored") {
        this.quests.completeStep(2); // Reach the Memory Shrine
      }
    }
  }

  /* ---------- interaction + linear story logic ---------- */

  // True while any modal UI is on screen or an area swap is mid-flight.
  isBusy() {
    return (
      (this.dialogue && this.dialogue.isActive) ||
      (this.menu && this.menu.isOpen) ||
      this.transitioning
    );
  }

  // Find the closest NPC or transition the player can interact with.
  findInteraction() {
    const px = this.player.x;
    let best = null;
    let bestD = Infinity;
    this.area.npcs.forEach((n) => {
      const d = Math.abs(px - n.x);
      if (d < NPC_RANGE && d < bestD) {
        best = { type: "npc", npc: n };
        bestD = d;
      }
    });
    this.area.pickups.forEach((p) => {
      const d = Math.abs(px - p.x);
      if (d < NPC_RANGE && d < bestD) {
        best = { type: "pickup", pickup: p };
        bestD = d;
      }
    });
    this.area.transitions.forEach((t) => {
      const d = Math.abs(px - t.x);
      if (d < t.range && d < bestD) {
        best = { type: "transition", transition: t };
        bestD = d;
      }
    });
    return best;
  }

  // Dispatch a conversation based on which NPC was approached.
  talkTo(npc) {
    this.player.setVelocityX(0);
    this.player.setTexture("player_idle");
    this.showPrompt(false);

    let convo;
    if (npc.id === "mira") convo = this._miraConvo();
    else if (npc.id === "bram") convo = this._bramConvo();
    else if (npc.id === "doran") convo = this._doranConvo();
    else if (npc.id === "spirit") convo = this._spiritConvo();
    else convo = { lines: ["..."], onComplete: null };

    this.dialogue.start(npc.name, convo.lines, convo.onComplete);
  }

  // --- Mira: starts "Fragments of Yesterday" and hands over the Old Iron Sword.
  _miraConvo() {
    if (!this.flags.fragmentsStarted) {
      this.flags.fragmentsStarted = true;
      this.quests.startQuest("Fragments of Yesterday", [
        "Talk to Mira",
        "Receive the Old Iron Sword",
        "Equip the Old Iron Sword",
      ]);
      this.quests.completeStep(0); // Talk to Mira
    }
    if (!this.flags.swordGiven) {
      return {
        lines: this.miraIntroLines.concat([this.miraGiveLine]),
        onComplete: () => this.grantSword(),
      };
    }
    if (this.equipment.get("weapon") !== "old_iron_sword") {
      return {
        lines: [
          "You should equip the sword. Something is wrong with the forest, and I don't want you going unprepared.",
        ],
        onComplete: null,
      };
    }
    return {
      lines: ["That sword suits you. Maybe my memories are not completely gone after all."],
      onComplete: null,
    };
  }

  // --- Elder Bram: starts "Into the Forest" and points the player to Doran.
  _bramConvo() {
    if (!this.flags.forestStarted) {
      this.flags.forestStarted = true;
      this.quests.startQuest("Into the Forest", [
        "Speak to Elder Bram",
        "Visit Blacksmith Doran",
        "Receive Leather Armor",
        "Equip Leather Armor",
        "Reach the Forest Gate",
      ]);
      // If leather is already equipped (e.g. quest tracker was swapped earlier),
      // sync the equip step so progress is not lost.
      if (this.equipment.get("armor") === "leather_armor") {
        this.flags.armorEquipped = true;
        if (this.flags.armorGiven) this.quests.completeStep(3);
      }
    }
    if (!this.flags.spokeToBram) {
      return {
        lines: [
          "You came back at a strange time, child. By morning, most of us will not remember this conversation.",
          "The forest is where the curse began. But do not enter it unprepared. Speak with Doran first.",
        ],
        onComplete: () => {
          this.flags.spokeToBram = true;
          this.quests.completeStep(0); // Speak to Elder Bram
          this.notifications.notify("Quest Updated: Visit Blacksmith Doran");
        },
      };
    }
    if (this.flags.armorGiven) {
      return {
        lines: ["Good. Armor will keep your body safe. But memories are harder to protect."],
        onComplete: null,
      };
    }
    return {
      lines: ["Doran is at his forge, past the village. He will prepare you for the forest."],
      onComplete: null,
    };
  }

  // --- Blacksmith Doran: gives Leather Armor once, only after Bram is met.
  _doranConvo() {
    if (!this.flags.spokeToBram) {
      return {
        lines: [
          "If Bram sent you, then I'll help. Otherwise, I can't hand out gear to every traveler with a sad story.",
        ],
        onComplete: null,
      };
    }
    if (!this.flags.armorGiven) {
      return {
        lines: [
          "So Bram finally told someone the truth... or part of it.",
          "Take this Leather Armor. The forest does not forgive the unprepared.",
        ],
        onComplete: () => this.grantArmor(),
      };
    }
    if (this.equipment.get("armor") !== "leather_armor") {
      return {
        lines: ["Equip that armor before you go. A sword means nothing if one shadow bite drops you."],
        onComplete: null,
      };
    }
    return {
      lines: ["Better. Now you look like someone who might survive past the first trees."],
      onComplete: null,
    };
  }

  // Old Iron Sword reward (given once, after Mira's first conversation).
  grantSword() {
    if (this.flags.swordGiven) return;
    this.flags.swordGiven = true;
    this.inventory.add("old_iron_sword");
    this.notifications.notify("Received Old Iron Sword");
    this.quests.completeStep(1); // Receive the Old Iron Sword
    this.notifications.notify("Quest Updated: Equip the Old Iron Sword");
  }

  // Leather Armor reward (given once, after Doran's gift conversation).
  grantArmor() {
    if (this.flags.armorGiven) return;
    this.flags.armorGiven = true;
    this.inventory.add("leather_armor");
    this.notifications.notify("Received Leather Armor");
    this.quests.completeStep(1); // Visit Blacksmith Doran
    this.quests.completeStep(2); // Receive Leather Armor
    this.notifications.notify("Quest Updated: Equip Leather Armor");
  }

  // Equip an item and refresh stats. Advances whichever quest step the
  // equip satisfies (Old Iron Sword finishes quest 1; Leather Armor moves
  // quest 2 toward the Forest Gate).
  equipItem(id) {
    this.equipment.equipById(id);
    this.menu.refresh(); // attack/defense numbers update immediately
    const activeName = this.quests.active ? this.quests.active.name : null;

    // #region agent log
    if (id === "leather_armor") {
      dbgLog(
        "game.js:equipItem",
        "leather armor equip attempt",
        {
          activeQuest: activeName,
          armorGiven: this.flags.armorGiven,
          armorEquippedFlag: this.flags.armorEquipped,
          equippedArmor: this.equipment.get("armor"),
          defense: this.playerData.defense,
        },
        "C"
      );
    }
    // #endregion

    if (
      id === "old_iron_sword" &&
      activeName === "Fragments of Yesterday" &&
      !this.flags.fragmentsComplete
    ) {
      this.flags.fragmentsComplete = true;
      this.quests.completeStep(2); // Equip the Old Iron Sword
      this.quests.markComplete();
      this.notifications.notify("Quest Complete: Fragments of Yesterday", 0x6fbf73);
    }

    if (id === "leather_armor") {
      this.flags.armorEquipped = true;
      if (activeName === "Into the Forest" && this.flags.armorGiven) {
        const step = this.quests.active && this.quests.active.steps[3];
        if (step && !step.done) {
          this.quests.completeStep(3);
          this.notifications.notify("Quest Updated: Reach the Forest Gate");
        }
      }
      // #region agent log
      dbgLog("game.js:equipItem", "leather armor sync", { armorEquippedFlag: this.flags.armorEquipped, activeQuest: activeName }, "A");
      // #endregion
    }
  }

  /* ================================================================ *
   *  STAGE 4: combat, the crystal, the Memory Spirit, and the ending.
   * ================================================================ */

  // Stop enemies from drifting while the world is paused (dialogue/menu/fade).
  freezeEnemies() {
    if (this.area) this.area.enemies.forEach((e) => e.freeze());
  }

  // Player melee attack on J: a short swing in front of the player that hits
  // any enemy in range for the current weapon's Attack value.
  performAttack(time) {
    if (time < this.attackReadyAt) return;
    this.attackReadyAt = time + 360; // cooldown keeps combat simple/reliable
    sfx.attack();

    const dir = this.facing;
    const ax = this.player.x + dir * 34;
    const ay = this.player.y - 4;
    this.spawnSwing(ax, ay, dir);

    const reach = 56;
    const halfH = 32;
    const rect = new Phaser.Geom.Rectangle(ax - reach / 2, ay - halfH, reach, halfH * 2);
    this.area.enemies.forEach((e) => {
      if (e.alive && e.sprite.active && Phaser.Geom.Intersects.RectangleToRectangle(rect, e.sprite.getBounds())) {
        e.hit(this.playerData.attack, this.player.x);
        this.spawnHitEffect(e.sprite.x, e.sprite.y);
      }
    });
  }

  // Runs enemy movement and resolves contact damage to the player.
  updateCombat(time) {
    if (!this.area || this.area.enemies.length === 0) return;
    const pb = this.player.getBounds();
    for (let i = this.area.enemies.length - 1; i >= 0; i--) {
      const e = this.area.enemies[i];
      e.update();
      if (!e.alive) {
        this.area.enemies.splice(i, 1);
        continue;
      }
      if (time > this.invincibleUntil && Phaser.Geom.Intersects.RectangleToRectangle(pb, e.sprite.getBounds())) {
        this.playerTakeDamage(e, time);
      }
    }
  }

  playerTakeDamage(enemy, time) {
    const dmg = Math.max(1, enemy.touchDamage - this.playerData.defense);
    this.playerData.hp = Math.max(0, this.playerData.hp - dmg);
    this.updateHUD();
    sfx.hurt();
    this.invincibleUntil = time + 1000; // brief mercy invincibility

    // Blink the player and knock them away from the enemy.
    this.tweens.killTweensOf(this.player);
    this.player.setAlpha(0.35);
    this.tweens.add({
      targets: this.player,
      alpha: 1,
      duration: 110,
      yoyo: true,
      repeat: 4,
      onComplete: () => this.player.setAlpha(1),
    });
    const kdir = this.player.x < enemy.sprite.x ? -1 : 1;
    this.player.setVelocityX(kdir * 240);
    this.player.setVelocityY(-260);
    this.spawnHitEffect(this.player.x, this.player.y);

    if (this.playerData.hp <= 0) this.gameOver();
  }

  gameOver() {
    if (this.dead) return;
    this.dead = true;
    this.freezeEnemies();
    sfx.gameover();
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("GameOver"));
  }

  /* ---------- combat / pickup visual effects ---------- */
  spawnSwing(x, y, dir) {
    const g = this.add.graphics().setDepth(11);
    g.lineStyle(5, 0xfff4c2, 0.7);
    g.beginPath();
    if (dir > 0) g.arc(x, y, 26, -0.8, 0.8, false);
    else g.arc(x, y, 26, Math.PI - 0.8, Math.PI + 0.8, true);
    g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: 180, onComplete: () => g.destroy() });
  }

  spawnHitEffect(x, y) {
    for (let i = 0; i < 5; i++) {
      const c = this.add.circle(x, y, 3, 0xfff0b0, 0.9).setDepth(12);
      const a = Math.random() * Math.PI * 2;
      this.tweens.add({
        targets: c,
        x: x + Math.cos(a) * 22,
        y: y + Math.sin(a) * 22,
        alpha: 0,
        duration: 260,
        onComplete: () => c.destroy(),
      });
    }
  }

  spawnDefeatEffect(x, y, type) {
    const col = type === "bat" ? 0x6a4a7a : type === "knight" ? 0x6a7080 : 0x4a3a6a;
    for (let i = 0; i < 8; i++) {
      const c = this.add.circle(x, y, Phaser.Math.Between(3, 6), col, 0.85).setDepth(12);
      const a = (i / 8) * Math.PI * 2;
      const d = Phaser.Math.Between(18, 42);
      this.tweens.add({
        targets: c,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d - 10,
        alpha: 0,
        scaleX: 0.3,
        scaleY: 0.3,
        duration: Phaser.Math.Between(300, 520),
        ease: "Quad.out",
        onComplete: () => c.destroy(),
      });
    }
    const wisp = this.add.circle(x, y - 10, 10, 0x8fd6ff, 0.6).setDepth(12);
    this.tweens.add({
      targets: wisp,
      y: y - 54,
      alpha: 0,
      scaleX: 1.6,
      scaleY: 1.6,
      duration: 620,
      onComplete: () => wisp.destroy(),
    });
  }

  spawnPickupEffect(x, y) {
    const ring = this.add.circle(x, y, 8, 0x8fe0ff, 0).setDepth(12);
    ring.setStrokeStyle(2, 0x8fe0ff, 0.9);
    this.tweens.add({ targets: ring, scaleX: 3.5, scaleY: 3.5, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
    for (let i = 0; i < 8; i++) {
      const c = this.add.circle(x, y, 2.5, 0xaef0ff, 0.95).setDepth(13);
      this.tweens.add({
        targets: c,
        x: x + Phaser.Math.Between(-26, 26),
        y: y - Phaser.Math.Between(20, 60),
        alpha: 0,
        duration: Phaser.Math.Between(420, 720),
        onComplete: () => c.destroy(),
      });
    }
  }

  /* ---------- the Broken Memory Crystal ---------- */
  collectCrystal(pickup) {
    if (this.flags.crystalFound) return;
    this.flags.crystalFound = true;
    this.storyItems.push("crystal");
    this.spawnPickupEffect(pickup.x, pickup.sprite.y);
    sfx.pickup();
    this.showPrompt(false);

    pickup.destroy();
    this.area.pickups = this.area.pickups.filter((p) => p !== pickup);

    this.notifications.notify("Found Broken Memory Crystal", 0x8fe0ff);
    if (this.quests.active && this.quests.active.name === "Truth Restored") {
      this.quests.completeStep(1); // Find the Broken Memory Crystal
      this.notifications.notify("Quest Updated: Reach the Memory Shrine");
    }
  }

  /* ---------- the Memory Spirit + the final reveal ---------- */
  _spiritConvo() {
    return {
      lines: [
        "You found your way here. Few remember enough to even try.",
        "Long ago, Willowmere did something it could not live with. An innocent was blamed for a betrayal they never committed.",
        "Rather than face that guilt, the village begged the old magic to take the memory away. The curse was not a punishment. It was a choice.",
        "But forgetting has a price. Each night, a little more of the village slips away.",
        "Mira's memories endured only because she held to something the curse could not pry loose - she cared for you.",
        "The truth is heavy, traveler. Yet only the truth can let Willowmere wake. Will you restore what was taken?",
      ],
      onComplete: () => this.restoreMemories(),
    };
  }

  restoreMemories() {
    if (this.quests.active && this.quests.active.name === "Truth Restored") {
      this.quests.completeStep(3); // Listen to the Memory Spirit
    }
    this.flags.truthComplete = true;
    sfx.chime();
    this.cameras.main.flash(700, 255, 255, 255);

    this.time.delayedCall(950, () => {
      if (this.quests.active && this.quests.active.name === "Truth Restored") {
        this.quests.completeStep(4); // Restore the village's memories
        this.quests.markComplete();
      }
      this.notifications.notify("Quest Complete: Truth Restored", 0x6fbf73);
    });
    this.time.delayedCall(2100, () => {
      this.cameras.main.fadeOut(700, 255, 255, 255);
      this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("Ending"));
    });
  }

  /* ---------- main loop ---------- */
  update(time, delta) {
    const JD = Phaser.Input.Keyboard.JustDown;

    // Player has died; the fade to the game-over screen is in flight.
    if (this.dead) {
      this.freezeEnemies();
      return;
    }

    // 0) Locked during an area fade transition.
    if (this.transitioning) {
      this.player.setVelocityX(0);
      this.freezeEnemies();
      return;
    }

    // 1) Inventory/equipment menu has top priority while open.
    if (this.menu.isOpen) {
      this.player.setVelocityX(0);
      this.player.setTexture("player_idle");
      this.freezeEnemies();
      this.menu.handleInput();
      return;
    }
    if (JD(this.keys.menu) && !this.dialogue.isActive) {
      this.menu.open();
      return;
    }

    const onGround = this.player.body.blocked.down || this.player.body.touching.down;
    const talkPressed = JD(this.keys.talk);
    const enterPressed = JD(this.keys.enter);

    // 2) Dialogue: advance/close while a conversation is active.
    if (this.dialogue.isActive) {
      this.player.setVelocityX(0);
      this.freezeEnemies();
      if (talkPressed || enterPressed) this.dialogue.advance();
      this.showPrompt(false);
      return;
    }

    // 3) Nearby NPC / pickup / transition -> show its prompt, act on E.
    const inter = this.findInteraction();
    if (inter) {
      let label;
      if (inter.type === "npc") label = "Talk to " + inter.npc.name;
      else if (inter.type === "pickup") label = "Take the " + inter.pickup.name;
      else if (inter.transition.requires && !inter.transition.requires(this)) label = inter.transition.lockedLabel;
      else label = inter.transition.label;
      this.setPrompt(label);
      this.showPrompt(true);

      if (talkPressed) {
        if (inter.type === "npc") {
          this.talkTo(inter.npc);
          return;
        }
        if (inter.type === "pickup") {
          this.collectCrystal(inter.pickup);
          return;
        }
        const t = inter.transition;
        if (t.requires && !t.requires(this)) {
          sfx.denied();
          // #region agent log
          if (t.to === "forest") {
            dbgLog(
              "game.js:update",
              "forest entry denied",
              {
                area: this.area.current,
                armorEquippedFlag: this.flags.armorEquipped,
                armorGiven: this.flags.armorGiven,
                equippedArmor: this.equipment.get("armor"),
                defense: this.playerData.defense,
                activeQuest: this.quests.active ? this.quests.active.name : null,
                playerX: Math.round(this.player.x),
              },
              "A"
            );
          }
          // #endregion
        } else {
          // #region agent log
          if (t.to === "forest") {
            dbgLog(
              "game.js:update",
              "forest entry allowed",
              {
                armorEquippedFlag: this.flags.armorEquipped,
                equippedArmor: this.equipment.get("armor"),
              },
              "A"
            );
          }
          // #endregion
          this.changeArea(t);
          return;
        }
      }
    } else {
      this.showPrompt(false);
    }

    // 4) Combat: attack on J, then run enemy movement + contact damage.
    if (JD(this.keys.attack)) this.performAttack(time);
    this.updateCombat(time);

    // 5) Side-scrolling movement (unchanged from Stage 1).
    const left = this.cursors.left.isDown || this.keys.left.isDown;
    const right = this.cursors.right.isDown || this.keys.right.isDown;
    const speed = 230;

    if (left && !right) {
      this.player.setVelocityX(-speed);
      this.facing = -1;
    } else if (right && !left) {
      this.player.setVelocityX(speed);
      this.facing = 1;
    } else {
      this.player.setVelocityX(0);
    }
    this.player.setFlipX(this.facing === -1);

    const jumpPressed = JD(this.keys.jump) || JD(this.cursors.up);
    if (jumpPressed && onGround) {
      this.player.setVelocityY(-560);
    }

    if (!onGround) {
      this.player.setTexture("player_jump");
    } else if (this.player.body.velocity.x !== 0) {
      this.walkTimer += delta;
      if (this.walkTimer > 130) {
        this.walkTimer = 0;
        this.walkFrame = this.walkFrame === 0 ? 1 : 0;
      }
      this.player.setTexture(this.walkFrame === 0 ? "player_walk1" : "player_walk2");
    } else {
      this.player.setTexture("player_idle");
    }
  }
}

/* ------------------------------------------------------------------ *
 *  Ending scene ("Truth Restored") - the single, final ending.
 * ------------------------------------------------------------------ */

class EndingScene extends Phaser.Scene {
  constructor() {
    super("Ending");
  }

  create() {
    this.cameras.main.fadeIn(800, 255, 255, 255);

    // Soft dawn gradient: the village waking to the truth.
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x2a2350, 0x3a3168, 0xb98a6a, 0xf0d9a8, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Rising sun glow.
    this.add.circle(GAME_WIDTH / 2, 430, 120, 0xffe9b0, 0.25);
    this.add.circle(GAME_WIDTH / 2, 430, 70, 0xfff3d0, 0.4);

    // Drifting motes of restored memory.
    for (let i = 0; i < 30; i++) {
      const c = this.add.circle(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(0, GAME_HEIGHT),
        Phaser.Math.FloatBetween(1.5, 3),
        0xfff3d0,
        0
      );
      this.tweens.add({ targets: c, alpha: Phaser.Math.FloatBetween(0.3, 0.7), duration: Phaser.Math.Between(900, 1800), yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 1500) });
      this.tweens.add({ targets: c, y: c.y - Phaser.Math.Between(20, 60), duration: Phaser.Math.Between(3000, 5000), yoyo: true, repeat: -1, ease: "Sine.inOut" });
    }

    const title = this.add
      .text(GAME_WIDTH / 2, 96, "Truth Restored", {
        fontFamily: "Georgia, serif",
        fontSize: "52px",
        color: "#fff3d6",
        stroke: "#241733",
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    title.setShadow(0, 6, "rgba(0,0,0,0.5)", 8);

    const paragraph =
      "The village remembered. Not all at once, and not without pain. But for the " +
      "first time in years, Willowmere woke up to the same truth. Mira remembered " +
      "your name. Elder Bram confessed what he had hidden. And the forest, finally " +
      "free from silence, began to heal.";
    this.add
      .text(GAME_WIDTH / 2, 240, paragraph, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "19px",
        color: "#f4ecff",
        align: "center",
        wordWrap: { width: 680 },
        lineSpacing: 8,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 360, "Willowmere remembers.  -  The End", {
        fontFamily: "Georgia, serif",
        fontSize: "18px",
        color: "#ffe9b0",
        fontStyle: "italic",
      })
      .setOrigin(0.5);

    makeRestartButton(this, 420, "Play Again");
  }
}

/* ------------------------------------------------------------------ *
 *  Game over scene (player HP reached 0 in the forest).
 * ------------------------------------------------------------------ */

class GameOverScene extends Phaser.Scene {
  constructor() {
    super("GameOver");
  }

  create() {
    this.cameras.main.fadeIn(400, 0, 0, 0);
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x14060a, 0x14060a, 0x2a0d14, 0x070406, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const title = this.add
      .text(GAME_WIDTH / 2, 150, "You Fell in the Forest", {
        fontFamily: "Georgia, serif",
        fontSize: "46px",
        color: "#e0564a",
        stroke: "#160608",
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    title.setShadow(0, 5, "rgba(0,0,0,0.6)", 8);

    this.add
      .text(GAME_WIDTH / 2, 232, "The shadows took you before the truth could be found.\nWillowmere sleeps on, forgetting.", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "19px",
        color: "#e8d6d2",
        align: "center",
        lineSpacing: 8,
      })
      .setOrigin(0.5);

    makeRestartButton(this, 350, "Restart");
  }
}

// Shared "restart" button used by both end-state scenes. Returns to the title
// so a brand-new run begins with fresh stats and inventory.
function makeRestartButton(scene, y, label) {
  const bx = GAME_WIDTH / 2;
  const btnW = 240;
  const btnH = 60;
  const btn = scene.add.graphics();
  const draw = (hover) => {
    btn.clear();
    btn.fillStyle(0x241733, 1);
    btn.fillRoundedRect(bx - btnW / 2 - 4, y - btnH / 2 - 4, btnW + 8, btnH + 8, 16);
    btn.fillStyle(hover ? 0xe0b93a : 0xc9a227, 1);
    btn.fillRoundedRect(bx - btnW / 2, y - btnH / 2, btnW, btnH, 14);
    btn.fillStyle(0xffffff, hover ? 0.18 : 0.1);
    btn.fillRoundedRect(bx - btnW / 2, y - btnH / 2, btnW, btnH / 2, 14);
  };
  draw(false);
  scene.add
    .text(bx, y, label, {
      fontFamily: "Georgia, serif",
      fontSize: "24px",
      color: "#241733",
      fontStyle: "bold",
    })
    .setOrigin(0.5);
  const hit = scene.add.zone(bx, y, btnW, btnH).setInteractive({ useHandCursor: true });
  hit.on("pointerover", () => draw(true));
  hit.on("pointerout", () => draw(false));
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    scene.cameras.main.fadeOut(300, 0, 0, 0);
    scene.cameras.main.once("camerafadeoutcomplete", () => scene.scene.start("Title"));
  };
  hit.on("pointerdown", go);
  scene.input.keyboard.once("keydown-ENTER", go);
  scene.input.keyboard.once("keydown-SPACE", go);
}

/* ------------------------------------------------------------------ *
 *  Game configuration
 * ------------------------------------------------------------------ */

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: "game-container",
  backgroundColor: "#0b0810",
  pixelArt: false,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 1500 },
      debug: false,
    },
  },
  scene: [BootScene, TitleScene, VillageScene, EndingScene, GameOverScene],
};

const game = new Phaser.Game(config);

// Expose the game instance for debugging / automated testing in the console.
window.game = game;
