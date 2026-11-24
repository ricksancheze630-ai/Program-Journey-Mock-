# Program Journey: concept prototype

A playable, browser-based vertical slice of **Program Journey** (working title). It's an Oregon Trail-style, turn-based horror journey. A family wakes inside a shared nightmare version of their Victorian house and has to climb from the living room to the roof before the sun goes down.

Built from `docs/Program_Journey_Design_Notes.pdf` (Nov 23, 2026).

## Play it

Open `index.html` in any modern browser. There's no build step and nothing to install.

- `index.html?debug` shows the hidden numbers (humanity, sun, dread, family state, items) in a strip under the status bar, for playtesting.
- A full run takes about 25 turns, roughly 5 to 10 minutes.

## What's in the slice

| Design note | How the prototype does it |
|---|---|
| **Three-band screen** | Pencil sketch on top, status strip in the middle (Candles, Supplies, Family x/4, draining Sun meter), and second-person text with 2 to 4 choices at the bottom. |
| **Degrading sketch** | `art.js` draws every scene in code as wobbly graphite on paper. A hidden `dread` value comes from floor, lost humanity and candles burned. It makes lines shakier, adds passes and darkens shading. As it rises, things appear in the corners: eyes, long fingers from the edge of the page, a tall figure, faces in the margins. Past a threshold the drawing jitters on its own. The only color is red pencil for the stuck sun and the glow of monster eyes. |
| **Prologue = general store** | Chores (trash $3, car $6, mow $10) trade sun for money. The Chef's kitchen sells food, water, blankets, candles and coffee. Then movie night and the fall-asleep beat. Chore money only works on the first floor. |
| **Opening scene** | Reworked to follow the wake-up beat, keeping the draft's three choices: *Wake Dad* / *Go upstairs alone* / *Turn the movie up and ignore it*. Each has a different consequence later. |
| **Floors as acts** | Main floor: foyer, closet, dining room, stairs. Second floor: a bedroom nightmare (Mom's, your brother's or yours), then the flooded laundry room as the river crossing (ford / float the basket / wait). Third floor: wallpaper of previous kids, the billiards-room bargain, the roof. |
| **Janitor + Lost & Found** | One closet per floor. All 5 items, each with its promise and its hidden cost (see below). Floor 1 costs chore money plus a little humanity, floor 2 costs more humanity, floor 3 the most. The Pack has a **Take off** button that never works, so players find out only by trying. |
| **Hidden humanity** | Never displayed. It shows through the player's sketch (glowing eyes, claws, extra knee joint, pointed ears, a dark spot on the chest, heavier shading), the narration ("You're scared, but your brother needs you" → "Your brother is slowing you down" → "The child climbs" → "It climbs"), family behavior (Mom drops "sweetheart", Dad steps between you and your brother, your brother goes quiet), kind options quietly disappearing and cold ones appearing, and mirrors, which are the honest check and cost a turn. |
| **Encounters** | Triggered only by the Night-Light Glasses. At three points, the next family member still with you vanishes and a monster appears. It cowers and backs away, and it talks in garbled static that is really their movie-night line. Menu: **Attack / Defend / Use Item / Lower your hands**. Lowering your hands is the only way to save them. The Seashell sometimes lies during fights ("It ate Dad. Hit it."). |
| **Item misdirect** | Killing a "monster" drops Dad's reading glasses (one lens cracked), Mom's bookmark or a red game piece. On the **Full** ending the descriptions rewrite ("…what the house took from you" → "…what you took from the house"). |
| **Endings** | Golden Hour, Hold the Door, Full (with the replay reveal) and Part of the House from the notes. Four gamebook-style bad endings added: Lights Out (sun runs out), Tumble Dry, Blanket Fort, Wrong Voice (the house uses a left-behind family member's voice). The ending screen tracks how many you've found. |
| **The house plays too** | Burning candles raises dread, so the art gets darker. Leaving someone behind lets the house use their voice at the roof door. Turning the movie up gets remarked on by the Janitor. Sneakers leave tracks that something follows. |

### Lost & Found items

| Item | Promise (shown) | Real effect in the prototype |
|---|---|---|
| Night-Light Glasses | Dark rooms don't need candles | Family faces get scribbled out in the sketches. Turns on the encounters. |
| Lucky Sneakers | Sun costs ×0.6 | Footprints on the stairs. Something follows them and eats candles or supplies. |
| Grandpa's Work Gloves | Open anything / use in fights | You can't hold your brother's hand, so he gets lost on stairs and in the laundry ford. In a fight they finish the job instantly. |
| A Seashell | The walls whisper hints | Some of the whispers are lies, including during fights. |
| A Heart Locket | No panic events on the stairs | Kind stair options vanish, and the slowest family member falls behind on the roof stairs. |

### Ending logic (in `computeEnding`)

- Humanity hits 0 at any point → **Part of the House**
- Sun hits 0 → **Lights Out**
- On the roof: humanity in the top range and all three family members still with you → **Golden Hour**. Nobody left → **Full**. Anything in between → **Hold the Door**.

## Placeholder answers to the open questions

The design doc leaves these open. The prototype uses quick placeholders so it can be played, and none of them are decisions:

- **Title:** still "Program Journey".
- **Chef:** an unremembered figure whose face "stays in the steam". It's left ambiguous whether it's family.
- **Janitor's voice:** friendly and unhurried. "Evening." / "Somebody left these behind. Maybe they'll help you." / "Fits like it was made for you." / "Keep it. That doesn't work up here." / "Last stop. Takes the edge off."
- **Family:** unnamed (Dad, Mom, your little brother). The player's age is never stated.
- **Billiards bargain:** the house offers +30 sun for leaving a family member at the table "to play a game", or +12 sun for three candles. A kind player can share food to rest.
- **The movie:** buying coffee keeps you awake long enough to see the movie is about this house. It ends on a girl on a roof lowering her hands, which hints at the mercy option.
- **Engine and art pipeline:** plain HTML, Canvas and JS with procedural pencil art. This is only a stand-in for real hand-drawn sketches. Each scene's art key maps to the sketch a real artist would draw, with degraded variants per dread level.

## Files

- `index.html`: layout and styles (the three bands and the Pack modal)
- `game.js`: state, scenes, encounters and endings. Each scene is data: `art`, `text()` and `choices()`, with costs on each choice.
- `art.js`: procedural sketchbook renderer and per-scene drawings
- `docs/Program_Journey_Design_Notes.pdf`: the source design notes
