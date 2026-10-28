# Development combat rules

The room owns melee outcomes. This is the representative combat loop for the
full rewrite, with deliberate development tuning and pending content/device
qualification. It does not provide production school admission or moderation.

## Authority and permission

An attack contains only epoch, ordered action sequence, consumed-input dependency
and owned-inventory revision. It has no victim, position, damage, reach, duration
or clock. The server uses the actor's consumed look and native eye position to
find the nearest eligible 0.6×1.8 player body on the bounded view ray. A shape-aware
solid line-of-sight check rejects intervening terrain. Partial shapes use their
actual collision geometry. Client interpolation/ray picking is presentation only.

Combat is allowed only in survival for connected, ready participant actors with
the separate `combat` capability. Both attacker and potential target must opt in
through that server-owned capability. Building permission is independent.
Observers, creative actors and actors outside combat permission cannot deal or
receive melee damage. The attacker must be focused and have live accepted input;
a target's open inventory does not grant immunity. School policy must populate
and refresh these capabilities through the pending admission/lifecycle adapter.

## Time, ownership and damage

| Held item | Damage | Cooldown | Reach |
| --- | --- | --- | --- |
| Empty hand or item without a combat profile | 2 | 15 ticks / 0.5 s | 3 blocks |
| Wooden pickaxe/shovel | 3 | 15 ticks / 0.5 s | 3 blocks |
| Stone pickaxe | 4 | 15 ticks / 0.5 s | 3 blocks |
| Wooden axe | 4 | 18 ticks / 0.6 s | 3 blocks |

The compiler validates authored profiles: damage 1–20, cooldown 3–60 ticks and
reach 1–4 blocks. Durable weapons wear once on an accepted hit; the final use
breaks the owned item. An expired input, stale inventory, forbidden capability or
unready actor cannot start an attack. A valid attack starts its cooldown even on
a miss, protected body or blocked ray. These outcomes do not wear a weapon.
Attacking cancels mining and costs 0.1 effort. Packet bursts cannot advance a
cooldown. The replay ledger returns cached outcomes or retires old actions after
cache eviction without repeating damage, wear, impulses, drops or hit feedback.

A successful melee hit starts ten ticks of target recovery, preventing another
melee hit during that window. Respawn supplies 60 ticks of combat protection.
Beginning an attack abandons the attacker's own protection. Protection does not
prevent authoritative fall, lava, drowning or starvation damage. All cooldown,
recovery and protection timers use world ticks and freeze on room pause. They
survive focus/epoch changes and room-local reconnect. Disconnected timers freeze
under the current vitals policy; durable serialization remains pending.

Six planks and a stick at a 3×3 workbench craft a heavy shield with 120 durability.
Equipping it in the offhand supplies 50% melee reduction and a 0.8 movement
multiplier. Armor reduction composes up to 80%; final damage is rounded up, with
at least one damage from an accepted hit. Each contributing equipped armor item
wears once. Items in the bag provide no armor. Breaking a shield immediately
updates the movement profile; the damage baseline carries the new profile.

Damage and inventory effects commit synchronously inside the serialized room.
Death follows the existing one-time private item drain and fresh respawn
readiness contract. Safe spawn search rejects body cells containing water or lava;
crossing into a new column still requires the normal collision-data exchange.

## Motion and feedback

A nonfatal hit adds a bounded native velocity impulse to an unfrozen body:
two horizontal units along the attack direction and an upward velocity of at
least 1.8. Receipt does not move the body or advance physics. The target gets a
fresh epoch/state/profile baseline and subsequent fixed steps resolve collision
and prediction. Frozen inventory bodies receive damage without a deferred hit
impulse. New epoch baselines clear queued local interactions rather than replaying
an old click after damage, movement, death or respawn.

Monotonic nearby hit events carry the server-selected parties, hit point, damage
and death outcome. They contain no private inventory or health snapshot. Both
parties and nearby viewers receive the effect; cached command results do not
re-emit it. The client deduplicates event sequence numbers and produces bounded
gold sparks, local positional impact audio and a Hebrew hit notice. It never
applies gameplay damage. The explicit touch/Q action attacks; ordinary left-click
on a pointed actor also attacks. Mining/building retain their existing controls.

Complete equipment capabilities/content disposition, remote held/offhand models,
final damage/death presentation, TNT, actual school/voice services, durable saves,
load/hardware qualification and cutover remain part of the full rewrite.
