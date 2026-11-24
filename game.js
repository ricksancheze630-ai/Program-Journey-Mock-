// Program Journey: engine + content for the playable prototype.
// Every scene is data: an art key, a text function, and a choices function. Choices carry visible costs
// (sun, candles, supplies, money). Humanity is hidden and only ever shown through art, narration and missing options.
"use strict";

// Hidden humanity: starts at HMAX, never displayed. Tuned so taking every item and winning every fight reaches the roof on fumes ("Full").
const HMAX = 14;

const NAMES = { dad: "Dad", mom: "Mom", bro: "your brother" };
const Cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- Lost & Found ----------
const ITEMS = {
  glasses:  { name: "Night-Light Glasses",  promise: "See in the dark. You'll barely need candles.", truth: "Monster eyes.", floor: 1,
              worn: "Everything is clear and silver in the dark. Faces are harder." },
  sneakers: { name: "Lucky Sneakers",       promise: "Run like the wind. Every turn costs less sun.", truth: "Monster legs.", floor: 1,
              worn: "You're so fast now. You can hear something keeping pace." },
  gloves:   { name: "Grandpa's Work Gloves", promise: "Open anything.", truth: "Claws.", floor: 2,
              worn: "Nothing in this house stays shut for you. Nothing stays held, either." },
  seashell: { name: "A Seashell",            promise: "Hold it to the wall and listen.", truth: "Monster ears.", floor: 2,
              worn: "The walls talk to you now. They're mostly honest." },
  locket:   { name: "A Heart Locket",        promise: "Wear it and you won't be scared.", truth: "Monster heart.", floor: 3,
              worn: "You aren't scared. Of anything. For anyone." },
};
// Price by floor: floor 1 costs chore money (plus the hidden cost); floors 2-3 cost humanity only, and more of it.
const HUM_PRICE = { 1: 1, 2: 2, 3: 3 };
const MONEY_PRICE = 4;

const DROPS = {
  dad: { name: "Dad's reading glasses", play: "One lens is cracked. A reminder of what the house took from you.", reveal: "One lens is cracked. A reminder of what you took from the house." },
  mom: { name: "Mom's bookmark",        play: "Still marking chapter twelve. She never got to finish it. The house saw to that.", reveal: "Still marking chapter twelve. She never got to finish it. You saw to that." },
  bro: { name: "A red board game piece", play: "Chewed on one end. His turn never came. Something in this house cheated.", reveal: "Chewed on one end. His turn never came. You cheated." },
};
const GARBLE = {
  dad: { clear: "Wake me up when it gets good.", clue: "...it's me... kiddo, it's me...", candle: "In the candlelight, for half a second, you see it's wearing a brown cardigan with elbow patches. Dad has that cardigan.", popcorn: "It picks up one piece and eats it slowly, one bite at a time, exactly the way someone you know eats popcorn.", truth: "Dad turned around. He saw your eyes. He didn't scream." },
  mom: { clear: "Five more pages, sweetheart.", clue: "...sweetheart... put them down... it's me...", candle: "In the candlelight you see something clutched to its chest. A book, held shut with one finger to keep the page.", popcorn: "It doesn't touch the popcorn. It sweeps it into a neat little pile with one claw, the way someone tidies up after movie night.", truth: "Mom held up her bookmark like it could protect her. She said \"sweetheart\" one more time. Then she didn't say anything." },
  bro: { clear: "It's my turn. You promised.", clue: "...my turn... you said... you'd play...", candle: "It's small in the candlelight. Smaller than it should be. Something red is clenched in one fist.", popcorn: "It snatches the popcorn and stuffs it in its mouth with both hands and then looks at you like it's waiting to get in trouble.", truth: "Your brother held out the red game piece. \"Your turn,\" he said." },
};
function garble(s, amt) {
  const noise = "▒░█▓~·";
  return s.split("").map(c => (c !== " " && Math.random() < amt) ? noise[Math.floor(Math.random() * noise.length)] : c).join("");
}

// ---------- state ----------
function newState() {
  const st = {
    scene: "title", sun: 100, candles: 1, supplies: 0, money: 0, hum: HMAX,
    floor: 0, fam: { dad: "with", mom: "with", bro: "with" },
    items: [], drops: [], killed: [], left: [], flags: {}, chores: [], fight: null, fightsDone: 0,
    candlesBurned: 0, turn: 0, extra: "", returnTo: null, revealed: false,
  };
  st.withYou = k => st.fam[k] === "with" || st.fam[k] === "saved";
  st.has = k => st.items.includes(k);
  st.famCount = () => 1 + ["dad", "mom", "bro"].filter(k => st.withYou(k) && !(st.fight && st.fight.who === k && !st.fight.done)).length;
  st.tier = () => st.hum >= 10 ? 0 : st.hum >= 6 ? 1 : st.hum >= 3 ? 2 : 3;
  st.dread = () => Math.min(1.45, st.floor * .22 + (HMAX - st.hum) * .05 + st.candlesBurned * .02 + (st.flags.asleep ? .05 : 0));
  return st;
}
let S = newState();

// Narration voice: [warm, cold, "the child", "it"]
const V = (...lines) => lines[Math.min(S.tier(), lines.length - 1)];
const sweet = () => S.hum >= 9 ? ", sweetheart" : "";
const supplyWord = n => n >= 5 ? "Good" : n >= 3 ? "Fair" : n >= 1 ? "Low" : "Out";
const kind = () => S.hum >= 9;   // kind options quietly vanish
const cold = () => S.hum <= 8;   // cold options quietly appear

function lose(k, how) {
  if (!S.withYou(k)) return;
  S.fam[k] = how; if (how === "lost") S.left.push(k);
}
function darkRoom(note) {
  if (S.has("glasses")) return `<p class="aside">The glasses turn the dark to silver. You don't need a candle.</p>`;
  if (S.candles > 0) { S.candles--; S.candlesBurned++; return `<p class="aside">You light a candle. ${note || ""}</p>`; }
  S.sun -= 5; return `<p class="aside">No candles. You feel your way in the dark, and something feels its way along beside you. (Lost time.)</p>`;
}

// ---------- scenes ----------
const SC = {};

SC.title = {
  art: "exterior",
  text: () => `<p>It's Friday night, and everything is perfectly normal.</p>
    <p>Movie night at the big brick Victorian on the hill. Half an acre of lawn, mountains out back, warm light in every downstairs window.</p>
    <p class="aside">Look closely at the third floor. Nobody is supposed to be up there.</p>`,
  choices: () => [{ label: "Begin", sub: "Movie night prep", go: "chores", cost: {} }],
};

SC.chores = {
  art: "yard",
  text: () => `<p>Mom's rule: nobody picks the movie or the snacks unless they've pulled their weight. The sun is already sliding toward the mountains.</p>
    ${S.extra}
    <p>${S.chores.length ? `You've got <b>$${S.money}</b> in chore money.` : "Pick your job."} Easy chores pay less. Hard chores pay more, but they eat daylight.</p>`,
  choices: () => [
    !S.chores.includes("trash") && { label: "Take out the trash", sub: "+$3", cost: { sun: 3 }, do: () => { S.money += 3; S.chores.push("trash"); S.extra = `<p>The bins are heavier than they should be. Something in the bottom one shifts when you set it down.</p>`; } },
    !S.chores.includes("car") && { label: "Wash the car", sub: "+$6", cost: { sun: 7 }, do: () => { S.money += 6; S.chores.push("car"); S.extra = `<p>The car gleams. In the windshield, the house reflects back with one more window lit than it has.</p>`; } },
    !S.chores.includes("mow") && { label: "Mow the half acre", sub: "+$10", cost: { sun: 13 }, do: () => { S.money += 10; S.chores.push("mow"); S.extra = `<p>Half an acre, row after row. By the time you're done, the sun's touching the mountains.</p>`; } },
    { label: S.chores.length ? "That's enough. Go inside." : "Skip chores. Go inside.", sub: "To the kitchen", go: "kitchen", cost: { sun: 1 }, do: () => { S.extra = ""; } },
  ],
};

SC.kitchen = {
  art: "kitchen",
  text: () => `<p>The Chef is behind the counter. You don't remember the family having a Chef, but nobody else thinks it's weird. A paper hat, a lot of steam, and the face sort of... stays in the steam.</p>
    <p>"Kitchen closes at sundown," says the Chef. "Stock up."</p>
    ${S.extra}<p>You have <b>$${S.money}</b>.</p>`,
  choices: () => {
    const buy = (label, sub, price, fn, once) => (!once || !S.flags[once]) && { label, sub: `$${price} · ${sub}`, disabled: S.money < price, cost: { sun: 1 }, do: () => { S.money -= price; fn(); if (once) S.flags[once] = true; } };
    return [
      buy("Food and popcorn", "+2 supplies", 2, () => { S.supplies += 2; S.extra = `<p>"Extra butter," says the Chef. "You'll need it."</p>`; }),
      buy("Water bottles", "+2 supplies", 2, () => { S.supplies += 2; S.extra = `<p>The Chef hands over a six-pack. "Stay hydrated. It's a long way up."</p>`; }),
      buy("Blankets", "+1 supplies, cozy", 3, () => { S.supplies += 1; S.flags.blankets = true; S.extra = `<p>Thick wool blankets. They smell like a basement you've never been in.</p>`; }, "blanketsBought"),
      buy("Candles", "+3 candles, \"in case the power goes out\"", 2, () => { S.candles += 3; S.extra = `<p>"In case the power goes out," the Chef says, and laughs. It's a long laugh.</p>`; }),
      buy("Instant coffee packets", "\"to stay awake for the whole movie\"", 1, () => { S.flags.coffee = true; S.extra = `<p>"Stay awake for the whole movie," says the Chef. "Nobody ever does."</p>`; }, "coffeeBought"),
      { label: "Start the movie", sub: "Pile onto the couch", go: "movie", cost: { sun: 1 }, do: () => { S.extra = ""; S.flags.movie = true; } },
    ];
  },
};

SC.movie = {
  art: "couch",
  text: () => `<p>Everybody piles onto the couch. Dad grabs the remote, puts his feet up and says what he always says: "Wake me up when it gets good."</p>
    <p>Mom opens her book. "Five more pages, sweetheart." Your brother sets up the board game on the rug for the third time. "After the movie you have to play. You promised. It's my turn first."</p>
    <p>The movie is about a big old house.</p>
    ${S.flags.coffee ? `<p>The coffee keeps you up longer than anyone. Long enough to notice that the house in the movie has your front porch. Your stairs. A closet with a man in it, mopping a dry floor. The last thing you see before your eyes close is a girl on a roof, at sunset, slowly <b>lowering her hands</b>.</p>` : `<p>That's all you catch. One by one, everybody drifts off. Then you do.</p>`}`,
  choices: () => [{ label: "Close your eyes", go: "wake", cost: {}, do: () => { S.flags.asleep = true; if (S.flags.coffee) S.flags.sawMovie = true; } }],
};

SC.wake = {
  art: "couch",
  onEnter: () => { S.floor = 1; },
  text: () => `<p>Same couch. Same blankets. The TV is static.</p>
    <p>Outside, the sun is still setting, but it's stuck. It's just hanging there over the mountains, bleeding red.</p>
    <p>Everything you bought is still here, in your lap, in your pockets, under the blankets. It doesn't feel like movie snacks anymore. It feels like a survival kit.</p>
    <p>Mom is awake and staring at the window. Your brother is holding your sleeve. Dad is still asleep.</p>
    <p>Upstairs, something heavy hits the floor. Then it starts dragging.</p>`,
  choices: () => [
    { label: "Wake Dad", sub: "He's useful later, but it costs a turn", cost: { sun: 6 }, go: "foyer", do: () => { S.extra = `<p>Dad wakes up the way he always does: "I wasn't asleep." Then he sees the window and doesn't say anything else.</p>`; } },
    { label: "Go upstairs alone", sub: "Faster, but you're vulnerable", cost: { sun: 1 }, go: "foyer", do: () => { S.fam.dad = "asleep"; S.left.push("dad"); S.flags.alone = true; S.extra = `<p>You go ahead. Behind you, Mom grabs your brother and follows, shouting for you to wait. Dad keeps snoring on the couch.</p><p>Something in the coat rack moves. You run, and you drop a candle running.</p>`; if (S.candles > 0) S.candles--; } },
    { label: "Turn the movie up and ignore it", sub: "Saves time now, and the house remembers", cost: { sun: 0 }, go: "foyer", do: () => { S.flags.remembers = true; S.extra = `<p>You turn it all the way up. Static fills the room. The dragging stops. A minute later Dad sits up on his own, rubbing his ears. "Who turned that up?"</p>`; } },
  ],
};

SC.foyer = {
  art: "hall",
  text: () => `${S.extra}<p>The front foyer. You open the front door, and it opens onto the back foyer. You try it again. Back foyer again.</p>
    <p>The dragging has moved. It's past the dining room now, near the storage closets. Those closets have been there your whole life, and you've never once wondered what was in them. Until now.</p>`,
  choices: () => [
    { label: "Light a candle and cut through the dining room", sub: "Slow, but you'll see", cost: { sun: 3, candles: S.has("glasses") ? 0 : 1 }, go: "closet1", do: () => { if (S.withYou("mom")) { S.flags.momNote = true; S.extra = `<p>On the hall table, by candlelight, Mom finds a note in handwriting none of you recognize. She reads it twice: <i>DON'T TAKE ANYTHING FROM THE CLOSETS.</i> She folds it into her book.</p>`; } else S.extra = ""; } },
    { label: "Feel your way along the wall in the dark", sub: "Saves a candle", cost: { sun: 2, supplies: 1 }, go: "closet1", do: () => { S.extra = `<p>You step on something soft. Popcorn, you hope. You lose half a bag finding out.</p>`; } },
    { label: "Follow the dragging sound", sub: "Straight to it", cost: { sun: 2 }, go: "closet1", do: () => { S.extra = ""; } },
    S.flags.blankets && { label: "Pull a blanket over everyone's heads and wait it out", sub: "Blanket fort rules", cost: { sun: 0 }, end: "blanket" },
  ],
};

function janitorScene(fl) {
  return {
    art: "closet",
    onEnter: () => { S.floor = fl; },
    text: () => {
      const intro = {
        1: `<p>A storage closet. Inside, a man in gray coveralls is mopping a floor that's already dry.</p>
            <p>You don't have a janitor. You've never had a janitor.</p>
            <p>"Evening," he says, like he's been expecting you. He nods at a cardboard box. "Somebody left these behind. Maybe they'll help you."</p>
            ${S.flags.remembers ? `<p>"Heard your movie," he adds. "Real loud. Everybody heard."</p>` : ""}
            ${S.flags.momNote && S.withYou("mom") ? `<p>Mom's hand tightens on your shoulder. She's still holding the note.</p>` : ""}`,
        2: `<p>The hall closet. Same man, same mop, same dry floor. "Evening," he says, like it's the first time.</p>
            <p>You hold out your chore money. He folds your fingers back over it, gently.</p>
            <p>"Keep it. That doesn't work up here." He taps the box. "I'll just take a little of you. You won't miss it."</p>`,
        3: `<p>The last closet. He's sitting on his bucket now, like he's been waiting a long time.</p>
            <p>"Last stop," he says. "Most folks pick something up here. Takes the edge off."</p>
            ${S.withYou("dad") && cold() ? `<p>Dad steps between you and your brother. He doesn't say why.</p>` : ""}`,
      }[fl];
      return `${S.extra}${intro}${S.flags.boughtMsg ? S.flags.boughtMsg : ""}`;
    },
    choices: () => {
      const avail = Object.keys(ITEMS).filter(k => ITEMS[k].floor <= fl && !S.has(k));
      const out = avail.map(k => {
        const it = ITEMS[k];
        const sub = fl === 1 ? `$${MONEY_PRICE} · ${it.promise}` : `"Nothing you'll miss." · ${it.promise}`;
        return { label: `Take the ${it.name}`, sub, disabled: fl === 1 && S.money < MONEY_PRICE, cost: { sun: 1 },
          do: () => { if (fl === 1) S.money -= MONEY_PRICE; S.items.push(k); S.hum -= HUM_PRICE[fl]; S.extra = "";
            S.flags.boughtMsg = `<p class="aside">He helps you put it on. "Fits like it was made for you." ${it.worn}</p>`; } };
      });
      out.push({ label: avail.length && out.length ? "\"We're fine, thanks.\" Keep moving." : "Keep moving", cost: { sun: 1 }, go: { 1: "dining", 2: "laundry", 3: "billiards" }[fl], do: () => { S.flags.boughtMsg = ""; S.extra = ""; } });
      return out;
    },
  };
}
SC.closet1 = janitorScene(1);
SC.closet2 = janitorScene(2);
SC.closet3 = janitorScene(3);

SC.dining = {
  art: "dining",
  text: () => `${S.extra}<p>The dining room table is set for five. There are four of you.</p>
    <p>The door to the stairs is locked, and the lock is on the <i>other</i> side. There's a pet door at the bottom. You've never had a pet.</p>`,
  choices: () => [
    S.withYou("dad") && { label: "Dad forces the door", sub: "He's good for this", cost: { sun: 3 }, go: "stairs1", do: () => { S.extra = `<p>Dad puts his shoulder into it. It gives on the third try. He rubs his arm and doesn't complain, which is how you know it hurt.</p>`; } },
    S.withYou("bro") && { label: "Send your brother through the pet door", sub: "He fits. Barely.", cost: { sun: 4 }, go: "stairs1", do: () => { S.extra = `<p>He goes through. For four long seconds there's nothing on the other side. Then the lock clicks, and he's grinning like he just won something.</p>`; } },
    { label: "Go the long way through the kitchen", sub: "Slow, but the kitchen's closed and nobody's watching the counter", cost: { sun: 8 }, go: "stairs1", do: () => { S.supplies += 2; S.extra = `<p>The kitchen is dark. A sign on the counter says CLOSED in the Chef's handwriting. You help yourself to leftovers (+2 supplies) and find the back stairs.</p>`; } },
    !S.flags.mirror1 && { label: "Look in the half-bath mirror", sub: "Costs a turn", cost: { sun: 3 }, go: "mirror", do: () => { S.flags.mirror1 = true; S.returnTo = "dining"; S.extra = ""; } },
  ],
};

function stairScene(n, next) {
  return {
    art: "stairs",
    text: () => {
      let t = S.extra;
      t += { 1: `<p>The stairs to the second floor. Halfway up, every light in the house goes out at once.</p>`,
             2: `<p>The stairs to the third floor are narrow, and they keep going after they should stop.</p>`,
             3: `<p>A ladder, then a hatch, then the roof door. Red light is coming under it, red like a stoplight.</p>` }[n];
      if (S.has("locket")) t += `<p class="aside">You don't flinch at anything anymore. You don't check whether everyone's keeping up, either.</p>`;
      else if (S.withYou("bro")) t += `<p>${V("Your brother's hand clamps onto yours, so hard it hurts.", "Your brother grabs for your hand.", "The little one reaches for the child's hand.", "Something small reaches for it.")}</p>`;
      t += `<p class="voice">${V("You're scared, but your brother needs you.", "Your brother is slowing you down.", "The child climbs.", "It climbs.")}</p>`;
      return t;
    },
    choices: () => {
      const after = () => {
        // stair hazards from Lost & Found
        let msg = "";
        if (S.has("gloves") && S.withYou("bro") && !S.flags["carried" + n]) { lose("bro", "lost"); msg += `<p>You reach for his hand. The gloves won't close around it. When you get to the top, he isn't behind you anymore.</p>`; }
        if (S.has("locket") && n === 3) { const slow = ["bro", "mom", "dad"].find(k => S.withYou(k)); if (slow) { lose(slow, "lost"); msg += `<p>At the top, you notice ${NAMES[slow]} isn't there. You notice the way you'd notice the weather.</p>`; } }
        if (S.has("sneakers") && !S.flags["tracks" + n]) { S.flags["tracks" + n] = true; if (S.candles >= 2) { S.candles -= 2; S.candlesBurned += 2; msg += `<p>Behind you there are wet footprints. Your footprints. They don't stop where you stopped. Something is walking in them, and it blows out two of your candles as it passes.</p>`; } else { S.supplies = Math.max(0, S.supplies - 1); msg += `<p>Behind you there are footprints. Your footprints. Something is walking in them, and it eats some of your supplies on the way.</p>`; } }
        S.extra = msg;
      };
      const opts = [
        S.withYou("bro") && kind() && !S.has("locket") && { label: n === 2 ? "Carry your brother" : "Hug your brother until it passes", sub: "He needs you", cost: { sun: n === 2 ? 6 : 4 }, do: () => { S.hum = Math.min(HMAX, S.hum + 1); S.flags["carried" + n] = true; after(); }, go: next },
        { label: n === 3 ? "Climb" : "Count the steps out loud and keep climbing", cost: { sun: 3 }, do: after, go: next },
        S.withYou("bro") && cold() && !S.has("locket") && { label: "Shake him off. He'll keep up.", cost: { sun: 1 }, do: () => { S.hum -= 1; lose("bro", "lost"); after(); S.extra = `<p>He doesn't keep up.</p>` + S.extra; }, go: next },
      ];
      return opts;
    },
  };
}
SC.stairs1 = stairScene(1, "fight:1:landing2");
SC.stairs2 = stairScene(2, "hall3");
SC.stairs3 = stairScene(3, "roofdoor");

SC.landing2 = {
  art: "hall",
  onEnter: () => { S.floor = 2; },
  text: () => `${S.extra}<p>The second floor. Every door on this hall is a bedroom, and every bedroom is somebody's nightmare.</p>
    <p>The laundry room is at the far end. From here you can hear water running. A lot of water.</p>
    ${S.has("seashell") ? `<p class="aside">You hold the seashell to the wall. "Mom's room," it whispers. "Take Mom's room."</p>` : ""}`,
  choices: () => [
    S.withYou("mom") && { label: "Cut through Mom's room", sub: "She reads old notes", cost: { sun: 4 }, go: "momroom", do: () => { S.extra = ""; } },
    S.withYou("bro") && { label: "Cut through your brother's room", sub: "He knows the shortcuts", cost: { sun: 2 }, go: "broroom", do: () => { S.extra = ""; } },
    { label: "Cut through your room", sub: "It's yours. How bad can it be?", cost: { sun: 3 }, go: "yourroom", do: () => { S.extra = ""; } },
  ],
};

SC.momroom = {
  art: "momroom",
  text: () => `${darkRoom("The pages flutter toward the flame.")}<p>Mom's room is full of paper. Pages from every book she's ever read are taped to the walls, the ceiling and the window, and every one of them is stopped at chapter twelve.</p>
    <p>Mom pulls one down and reads it fast, the way she reads when she's scared. "Somebody wrote in the margin${sweet()}."</p>
    <p>The margin says: <i>HE WAS NEVER HIRED. DON'T LET HIM DRESS YOU. IF THEY LOOK LIKE MONSTERS, LOOK AGAIN.</i></p>`,
  choices: () => [
    { label: "Take the page", cost: { sun: 1 }, go: "closet2", do: () => { S.flags.page = true; S.extra = `<p class="aside">You fold the page into your pocket.</p>`; } },
    { label: "Leave it. Keep moving.", cost: { sun: 1 }, go: "closet2", do: () => { S.extra = ""; } },
  ],
};
SC.broroom = {
  art: "broroom",
  text: () => `<p>Your brother's room is built out of board games. The walls are boxes. The floor is a board. Somebody has written YOUR TURN across the ceiling.</p>
    <p>The only way through is a vent no bigger than a cereal box. ${S.hum <= 6 ? "Your brother doesn't say anything. He hasn't said anything for a while." : `"I can fit," he says. "But then it's my turn. You promised."`}</p>`,
  choices: () => [
    kind() && { label: "\"Deal. It's your turn.\"", sub: "Let him go first", cost: { sun: 3 }, go: "closet2", do: () => { S.hum = Math.min(HMAX, S.hum + 1); S.extra = `<p>He wriggles through the vent and opens the far door from the other side, beaming. For a second, it's just movie night again.</p>`; } },
    { label: "Send him through the vent", cost: { sun: 2 }, go: "closet2", do: () => { S.extra = `<p>He goes. The far door opens. He doesn't look at you.</p>`; } },
    cold() && { label: "\"Hurry up.\"", cost: { sun: 1 }, go: "closet2", do: () => { S.hum -= 1; S.flags.broSilent = true; S.extra = `<p>He hurries. He stops talking to you after that.</p>`; } },
  ],
};
SC.yourroom = {
  art: "yourroom",
  text: () => `<p>Your room is exactly your room. That's the scary part.</p><p>Everything's where you left it, except the mirror. It's been turned around to face the wall.</p>`,
  choices: () => [
    { label: "Turn the mirror around", sub: "Costs a turn", cost: { sun: 3 }, go: "mirror", do: () => { S.returnTo = "closet2"; S.extra = ""; } },
    { label: "Leave it facing the wall", cost: { sun: 1 }, go: "closet2", do: () => { S.extra = ""; } },
  ],
};

SC.mirror = {
  art: "mirror",
  text: () => {
    const lines = [];
    if (S.hum >= 12) lines.push("You look tired and scared and a little pale. But it's you. Still you.");
    else if (S.hum >= 8) lines.push("You look fine. You look fine. Why do you keep telling yourself that?");
    else if (S.hum >= 3) lines.push("Something in the glass smiles a half-second before you do.");
    else lines.push("The mirror shows the room behind you. Just the room.");
    if (S.has("glasses")) lines.push("Your eyes don't reflect the candle. They make their own light.");
    if (S.has("gloves")) lines.push("The gloves end in something that isn't fingers.");
    if (S.has("sneakers")) lines.push("Your knees bend one joint too many.");
    if (S.has("seashell")) lines.push("Your ears have curled to a point, like they're listening to something behind you.");
    if (S.has("locket")) lines.push("The locket ticks against your chest. It isn't a clock.");
    if (S.hum <= 6 && S.candles > 0) { S.candles--; lines.push("You drop a candle and don't pick it up."); }
    return `<p>${lines.join("</p><p>")}</p>`;
  },
  choices: () => [{ label: "Look away", cost: { sun: 0 }, go: S.returnTo || "closet2" }],
};

SC.laundry = {
  art: "laundry",
  onEnter: () => { S.floor = 2; },
  text: () => `${S.extra}<p>The laundry room is flooded hip-deep and still filling. Socks drift past like fish. Something bigger drifts past slower.</p>
    <p>The stairs up are on the far side.</p>`,
  choices: () => [
    { label: "Ford it. Just wade across.", sub: "Fast, but you'll lose supplies", cost: { sun: 3, supplies: 2 }, go: "fight:2:stairs2", do: () => {
      let m = `<p>The water is cold enough to hurt. Half your supplies float away.</p>`;
      if (S.withYou("bro")) {
        if (S.has("gloves")) { lose("bro", "lost"); m += `<p>You reach for your brother's hand and the gloves won't close around it. The current takes him under the dryers. You don't see where he comes up.</p>`; }
        else if (S.withYou("dad")) m += `<p>Dad carries your brother across on his shoulders.</p>`;
        else m += `<p>You hold your brother's hand the whole way. He doesn't let go once.</p>`;
      }
      S.extra = m; } },
    S.flags.blankets && { label: "Stuff a blanket in the laundry basket and float everything across", sub: "Slower, nothing lost", cost: { sun: 5 }, go: "fight:2:stairs2", do: () => { S.extra = `<p>The blanket soaks up the leaks just long enough. Everyone and everything makes it across dry.</p>`; } },
    { label: "Wait for the water to go down", sub: "Safe, and very slow", cost: { sun: 12 }, go: "fight:2:stairs2", do: () => { S.extra = `<p>You wait. And wait. The sun doesn't move, but the meter does. Eventually the water drains with a sound like a long, satisfied drink.</p>`; } },
    { label: "Hide in the dryer until it's over", sub: "It's warm in there", cost: { sun: 0 }, end: "dryer" },
  ],
};

SC.hall3 = {
  art: "wallpaper",
  onEnter: () => { S.floor = 3; },
  text: () => `${S.extra}<p>The third floor. The wallpaper up here is a pattern of children: little printed faces, row after row, all smiling.</p>
    <p>Some of them are wearing glasses.</p>
    ${S.withYou("mom") ? `<p>Mom says your name${kind() ? ", soft, like she's checking you're still there" : ". Just your name. Not sweetheart"}.</p>` : ""}`,
  choices: () => [
    { label: "Look closer at the wallpaper", cost: { sun: 2 }, go: "closet3", do: () => { S.flags.lookedWall = true; S.extra = S.has("glasses") ? `<p class="aside">They aren't printed. They're pressed flat. Every one of them is wearing the same glasses you're wearing. One of them waves.</p>` : `<p class="aside">They aren't printed. They're pressed flat. Every one of them is wearing the same glasses that were in the Janitor's box.</p>`; } },
    { label: "Don't look. Keep going.", cost: { sun: 1 }, go: "closet3", do: () => { S.extra = ""; } },
  ],
};

SC.billiards = {
  art: "billiards",
  text: () => `${S.extra}<p>The billiards room is warm. The lamp over the table is on, and nothing in here is trying to hurt you. That's how you know it wants something.</p>
    <p>The cue ball rolls across the felt on its own and stops in front of you. A voice comes out of the corner pocket. It sounds like the TV.</p>
    <p>"Let's make a deal," says the house. "I've got all the sun you want. Just leave somebody here to play a game with me."</p>
    ${S.flags.sawMovie && !S.flags.movieHint ? `<p class="aside">The cue ball is the eye from the movie. You remember the last scene: a girl on a roof at sunset, lowering her hands.</p>` : ""}`,
  choices: () => {
    const go = "fight:3:stairs3";
    const deals = ["dad", "mom", "bro"].filter(k => S.withYou(k)).map(k => ({ label: `Leave ${NAMES[k]} at the table`, sub: "+30 sun", cost: { sun: -30 }, go, do: () => { S.hum -= 2; lose(k, "lost"); S.flags.movieHint = true; S.extra = `<p>${Cap(NAMES[k])} sits down at the table without arguing. The cue rises on its own. "Break," says the house, delighted. You don't look back.</p>`; } }));
    return [
      ...deals,
      S.candles >= 3 && { label: "Trade three candles for daylight", sub: "+12 sun", cost: { candles: 3, sun: -12 }, go, do: () => { S.flags.movieHint = true; S.candlesBurned += 3; S.extra = `<p>The house blows them out one at a time, slowly, like birthday candles. The sun outside climbs back up a little.</p>`; } },
      S.supplies >= 2 && S.famCount() > 1 && kind() && { label: "Share the food and rest a minute", sub: "Together", cost: { sun: 3, supplies: 2 }, go, do: () => { S.hum = Math.min(HMAX, S.hum + 1); S.flags.movieHint = true; S.extra = `<p>You sit on the floor and split the last of the popcorn. Nobody talks. Nobody has to.</p>`; } },
      { label: "\"No deal.\"", cost: { sun: 2 }, go, do: () => { S.flags.movieHint = true; S.extra = `<p>"Suit yourself," says the house. "Everybody deals eventually."</p>`; } },
      !S.flags.mirror3 && { label: "Look in the mirror behind the bar", sub: "Costs a turn", cost: { sun: 3 }, go: "mirror", do: () => { S.flags.mirror3 = true; S.returnTo = "billiards"; } },
    ];
  },
};

SC.roofdoor = {
  art: "stairs",
  text: () => {
    const voice = S.left.find(k => S.fam[k] === "lost" || S.fam[k] === "asleep");
    S.flags.voiceOf = voice;
    return `${S.extra}<p>The roof door. One more push.</p>
      ${voice ? `<p>From back down the ladder, a voice: "Wait for me! Wait, please, I'm right here." It sounds exactly like ${NAMES[voice]}.</p>` : `<p>Behind you the house is quiet. Listening.</p>`}`;
  },
  choices: () => [
    S.flags.voiceOf && { label: `Go back for ${NAMES[S.flags.voiceOf]}`, cost: { sun: 2 }, end: "voice" },
    { label: "Open the roof door", cost: { sun: 0 }, go: "roof" },
  ],
};

SC.roof = {
  art: "roof",
  onEnter: () => { S.floor = 4; },
  text: () => `<p>The roof. The sun is right there, huge and red and finally, finally moving.</p>`,
  choices: () => [{ label: "Step into the sunset", cost: { sun: 0 }, end: computeEnding() }],
};

// ---------- encounters ----------
function fightTarget() { return ["dad", "mom", "bro"].find(k => S.fam[k] === "with"); }
SC.fight = {
  art: "fight",
  text: () => {
    const f = S.fight, g = GARBLE[f.who];
    if (f.done === "gone") return `<p>The thing collapses into shadow and is gone.</p><p>Where it fell, you find ${DROPS[f.who].name.replace(/^A /, "a ")}. ${f.who === "dad" ? "One lens is cracked. " : ""}${f.who === "mom" ? "She" : "He"} was here. You're too late.</p>`;
    if (f.done === "fled") return `<p>It turns and runs, down into the dark, still making that noise. Then it's gone.</p><p>${Cap(NAMES[f.who])} never comes back.</p>`;
    if (f.done === "saved") return `<p>You lower your hands.</p><p>It stops. Through the glasses it's still a monster. All teeth, all angles. But it sits down on the step next to you, breathing hard, and it's breathing exactly like ${NAMES[f.who]}.</p><p>"${g.clear}" it says. You hear every word.</p>`;
    let t = "";
    if (f.round === 0) t += `<p>You turn around. ${Cap(NAMES[f.who])} isn't behind you anymore.</p><p>Something is. Through the glasses it's all teeth and wrong angles, taller than the doorway and hunched to fit. It doesn't come at you. It just stands there swaying, making a sound like a radio between stations.</p>`;
    t += f.log;
    t += `<p class="garble">"${garble(f.round % 2 ? g.clue : g.clear, Math.max(.18, .4 - f.round * .06))}"</p>`;
    return t;
  },
  choices: () => {
    const f = S.fight;
    if (f.done) return [{ label: f.done === "saved" ? "Keep climbing, together" : "Keep climbing", cost: { sun: 0 }, go: f.next, do: () => { S.fight = null; } }];
    const round = (fn) => () => { f.round++; f.cower = false; f.log = ""; fn(); };
    const hit = () => { f.attacks++; if (f.attacks >= 2) { S.hum -= 1; finish("gone"); } else { f.cower = true; f.log = `<p>You swing. It doesn't swing back. It throws its arms over its head and backs into the wall, and the noise it makes sounds almost like a word.</p>`; } };
    const items = [
      S.candles > 0 && { label: "Hold up a candle", cost: { sun: 2, candles: 1 }, do: round(() => { f.log = `<p>${GARBLE[f.who].candle}</p>`; }) },
      S.supplies > 0 && { label: "Throw it some popcorn", cost: { sun: 2, supplies: 1 }, do: round(() => { f.log = `<p>${GARBLE[f.who].popcorn}</p>`; }) },
      S.has("gloves") && { label: "Use Grandpa's gloves", sub: "Open anything", cost: { sun: 2 }, do: round(() => { S.hum -= 2; finish("gone"); }) },
      S.has("seashell") && { label: "Listen with the seashell", cost: { sun: 2 }, do: round(() => {
        // the house learns to whisper, and some of what it says is a lie
        f.log = (f.shell = (f.shell || 0) + 1) % 2 ? `<p class="aside">The shell whispers: "It ate ${NAMES[f.who]}. It's still chewing. Hit it."</p>` : `<p class="aside">Under the static, clear as anything: "${GARBLE[f.who].clue.replace(/\.\.\./g, " ").trim()}"</p>`; }) },
    ];
    if (f.menu === "items") return [...items, { label: "Back", cost: { sun: 0 }, do: () => { f.menu = null; } }];
    return [
      { label: "Attack", cost: { sun: 2 }, do: round(hit) },
      { label: "Defend", cost: { sun: 2 }, do: round(() => { f.defends++; if (f.defends >= 2) finish("fled"); else f.log = `<p>You brace. It doesn't come. It backs away, step by step, still making that noise.</p>`; }) },
      { label: "Use Item", cost: { sun: 0 }, disabled: !items.some(Boolean), do: () => { f.menu = "items"; } },
      { label: "Lower your hands", cost: { sun: 2 }, do: round(() => { f.lowered = true; finish("saved"); }) },
    ];
  },
};
function finish(how) {
  const f = S.fight; f.done = how; f.menu = null;
  if (how === "gone") { lose(f.who, "gone"); S.killed.push(f.who); S.drops.push(f.who); }
  if (how === "fled") lose(f.who, "lost");
  if (how === "saved") { S.fam[f.who] = "saved"; S.hum = Math.min(HMAX, S.hum + 1); }
}
// "fight:slot:next": if the glasses are on and someone is still with you, they become the monster.
function route(target) {
  if (typeof target === "string" && target.startsWith("fight:")) {
    const [, , next] = target.split(":");
    const who = S.has("glasses") ? fightTarget() : null;
    if (!who) return next;
    S.fight = { who, next, round: 0, attacks: 0, defends: 0, log: "", done: null };
    S.fightsDone++;
    return "fight";
  }
  return target;
}

// ---------- endings ----------
function computeEnding() {
  const withMe = ["dad", "mom", "bro"].filter(k => S.withYou(k));
  if (S.hum >= 10 && withMe.length === 3) return "golden";
  if (withMe.length === 0) return "full";
  return "door";
}
const ENDINGS = {
  golden: { title: "Golden Hour", art: "end_golden", text: () => `<p>The sunset swallows all of you.</p><p>You wake up on the couch. The credits are rolling. Out the window there's a real sunset, the normal kind, already halfway behind the mountains. Dad is snoring. Mom is on chapter thirteen. Your brother is shaking your arm: "It's my turn. You promised."</p><p>Everyone's fine. Perfectly normal.</p><p class="aside">On the coffee table there's a pair of glasses that wasn't there before.</p>` },
  door: { title: "Hold the Door", art: "end_door", text: () => { const w = ["dad", "mom", "bro"].filter(k => S.withYou(k)).map(k => NAMES[k]); return `<p>${S.hum >= 10 ? "You could leave. But somebody has to hold the door, and you're the one who brought the house all the way up here." : "You're too far gone to leave, and you know it."}</p><p>You put your back against the roof door and hold it shut against the house so ${w.join(" and ")} can walk out into the sun.</p><p>The house pounds on the door for a long time. You hold it longer.</p><p class="aside">Next movie night, a new family piles onto the couch. In the wallpaper, a face that looks a lot like yours is smiling gently.</p>`; } },
  full: { title: "Full", art: "end_full", text: () => {
    let t = `<p>You reach the roof, and the sunset is beautiful.</p><p>You're alone up here. You don't mind. You're not even hungry anymore.</p>`;
    if (S.killed.length || S.left.length) t += `<p>Then you remember. All of it, with the missing lines filled in:</p>`;
    S.killed.forEach(k => t += `<p class="reveal">${GARBLE[k].truth}</p>`);
    S.left.forEach(k => { if (!S.killed.includes(k)) t += `<p class="reveal">You left ${NAMES[k]} behind. ${k === "bro" ? "He" : k === "mom" ? "She" : "He"} called your name for a long time.</p>`; });
    if (S.killed.length) t += `<p><b>Every fight was a family member.</b> The house never took anyone. You did.</p>`;
    return t; } },
  house: { title: "Part of the House", art: "end_house", text: () => `<p>Somewhere between one step and the next, ${V("you", "you", "the child", "it")} stop${S.tier() >= 2 ? "s" : ""} climbing.</p><p>You never leave.</p><p class="aside">The next kid who comes through will see you in the wallpaper, smiling, wearing your new glasses.</p>` },
  sundown: { title: "Lights Out", art: "end_sundown", text: () => `<p>The sun finishes setting. It does it all at once, like somebody hit a switch.</p><p>In the dark, the house says, in Dad's voice, "Wake me up when it gets good."</p><p>Nobody ever wakes anybody up again.</p>` },
  dryer: { title: "Tumble Dry", art: "end_dryer", text: () => `<p>It's warm in the dryer. It's dark and it smells like fabric softener and it's so, so quiet.</p><p>Then somebody outside shuts the door and sets the dial to DELICATE.</p><p>You go round and round for a very long time. They find your socks, eventually. They never match.</p>` },
  blanket: { title: "Blanket Fort", art: "end_blanket", text: () => `<p>Under the blanket it's warm and safe, and the dragging gets closer and closer and stops right next to the couch.</p><p>Something lifts the corner of the blanket.</p><p>"Found you," says the Janitor, and he tucks you all in. Tight. Tighter.</p>` },
  voice: { title: "Wrong Voice", art: "end_voice", text: () => { const n = NAMES[S.flags.voiceOf]; return `<p>You climb back down. ${Cap(n)} is at the bottom of the ladder, smiling up at you.</p><p>The smile is a little too wide. And ${n}, now that you think about it, has never once had that many teeth.</p><p class="aside">The house uses their voice. It always does.</p>`; } },
};

// ---------- engine ----------
const $ = id => document.getElementById(id);
const DEBUG = /[?&]debug/.test(location.search);
let seen = {};
try { seen = JSON.parse(localStorage.getItem("pj-endings") || "{}") || {}; } catch (e) { seen = {}; }

function applyCost(c) {
  let sun = c.sun || 0;
  if (sun > 0 && S.has("sneakers")) sun = Math.max(1, Math.round(sun * .6));
  S.sun = Math.min(100, S.sun - sun);
  if (c.candles) { S.candles -= c.candles; S.candlesBurned += c.candles > 0 ? c.candles : 0; }
  if (c.supplies) S.supplies = Math.max(0, S.supplies - c.supplies);
}
function costLabel(c) {
  const parts = [];
  let sun = c.sun || 0; if (sun > 0 && S.has("sneakers")) sun = Math.max(1, Math.round(sun * .6));
  if (sun > 0) parts.push(`☀ −${sun}`); if (sun < 0) parts.push(`☀ +${-sun}`);
  if (c.candles > 0) parts.push(`🕯 −${c.candles}`); if (c.supplies > 0) parts.push(`supplies −${c.supplies}`);
  return parts.join(" · ");
}

function choose(ch) {
  if (ch.disabled) return;
  S.turn++;
  applyCost(ch.cost || {});
  if (ch.do) ch.do();
  if (ch.end) return ending(ch.end);
  if (S.hum <= 0) return ending("house");
  if (S.sun <= 0) return ending("sundown");
  if (ch.go) go(route(ch.go)); else draw();
}
function go(id) { S.scene = id; const sc = SC[id]; if (sc.onEnter) sc.onEnter(); draw(); }

let wobbleTimer = null;
function paint(artKey) {
  const cv = $("sketch");
  const seed = artKey + ":" + S.scene + ":" + (S.fight ? S.fight.who + S.fight.round : "") + ":" + S.turn;
  Sketch.render(cv, artKey, S, seed, 0);
  clearInterval(wobbleTimer);
  if (S.dread() > .75) { let w = 0; wobbleTimer = setInterval(() => Sketch.render(cv, artKey, S, seed, ++w % 3), 900); }
}

function draw() {
  const sc = SC[S.scene];
  const text = sc.text();
  paint(sc.art);
  $("text").innerHTML = text;
  const list = $("choices"); list.innerHTML = "";
  sc.choices().filter(Boolean).forEach(ch => {
    const b = document.createElement("button");
    b.className = "choice"; b.disabled = !!ch.disabled;
    const cl = costLabel(ch.cost || {});
    b.innerHTML = `<span class="lbl">${ch.label}</span>${ch.sub || cl ? `<span class="sub">${[ch.sub, cl].filter(Boolean).join(" · ")}</span>` : ""}`;
    b.onclick = () => choose(ch);
    list.appendChild(b);
  });
  status();
  $("band").scrollTop = 0;
}

function status() {
  const intro = S.scene === "title";
  $("strip").style.visibility = intro ? "hidden" : "visible";
  $("candles").textContent = S.candles;
  $("supplies").textContent = supplyWord(S.supplies);
  $("family").textContent = `${S.famCount()}/4`;
  $("moneyWrap").style.display = S.floor <= 1 && !intro ? "" : "none";
  $("money").textContent = "$" + S.money;
  $("sunfill").style.width = Math.max(0, S.sun) + "%";
  $("sunfill").classList.toggle("low", S.sun < 25);
  $("packBtn").style.display = intro ? "none" : "";
  if (DEBUG) $("debug").textContent = `humanity ${S.hum} · sun ${S.sun} · dread ${S.dread().toFixed(2)} · fam ${JSON.stringify(S.fam)} · items ${S.items.join(",")}`;
}

function ending(key) {
  clearInterval(wobbleTimer);
  const E = ENDINGS[key];
  S.revealed = key === "full";
  seen[key] = true; try { localStorage.setItem("pj-endings", JSON.stringify(seen)); } catch (e) {}
  S.scene = "end";
  Sketch.render($("sketch"), E.art, S, "end:" + key, 0);
  $("text").innerHTML = `<h2 class="endtitle">${E.title}</h2>${E.text()}${packHTML(true)}
    <p class="aside found">Endings found: ${Object.keys(seen).length} of ${Object.keys(ENDINGS).length}</p>`;
  $("choices").innerHTML = "";
  const again = document.createElement("button"); again.className = "choice"; again.innerHTML = `<span class="lbl">Try another door</span><span class="sub">Start over</span>`;
  again.onclick = () => { S = newState(); go("chores"); };
  $("choices").appendChild(again);
  status();
}

function packHTML(final) {
  const rows = [];
  S.items.forEach(k => { const it = ITEMS[k]; rows.push(`<li><b>${it.name}</b>: ${final ? `<span class="truth">${it.truth}</span>` : it.promise}</li>`); });
  S.drops.forEach(k => { const d = DROPS[k]; rows.push(`<li><b>${d.name}</b>: ${S.revealed ? `<span class="truth">${d.reveal}</span>` : d.play}</li>`); });
  if (!rows.length) return final ? "" : `<p class="aside">Just snacks and candles.</p>`;
  return `<ul class="pack">${rows.join("")}</ul>`;
}
function openPack() {
  const box = $("packBody");
  box.innerHTML = `<p class="aside">Candles: ${S.candles} · Supplies: ${supplyWord(S.supplies)}${S.flags.blankets ? " · Blankets" : ""}${S.flags.coffee ? " · Coffee" : ""}${S.flags.page ? " · A page from Mom's room" : ""}</p>${packHTML(false)}`;
  S.items.forEach(k => {
    const b = document.createElement("button"); b.className = "choice small";
    b.innerHTML = `<span class="lbl">Take off the ${ITEMS[k].name}</span><span class="sub">☀ −2</span>`;
    b.onclick = () => {
      applyCost({ sun: 2 }); S.turn++;
      const msg = { glasses: "You pull at the glasses. A little of your face comes with them. You stop pulling.", sneakers: "You tug at the laces. They aren't laces anymore.", gloves: "You pull at the fingertips. Something underneath pulls back.", seashell: "You take the shell away from your ear. You can still hear it.", locket: "You open the clasp. It's not a clasp. It's a valve." }[k];
      box.insertAdjacentHTML("beforeend", `<p class="aside">${msg}</p>`); b.remove(); status();
      if (S.sun <= 0) { closePack(); ending("sundown"); }
    };
    box.appendChild(b);
  });
  $("pack").classList.add("show");
}
function closePack() { $("pack").classList.remove("show"); }

window.addEventListener("DOMContentLoaded", () => {
  $("packBtn").onclick = openPack; $("packClose").onclick = closePack;
  if (DEBUG) $("debug").style.display = "block";
  go("title");
});
// test hook
window.PJ = { get S() { return S; }, SC, choose, ENDINGS, newState, reset: () => { S = newState(); go("title"); } };
