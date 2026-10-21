/** Courses built around rides, rather than rides decorating a walkable road. */
import { CLOCKWORK_CROSSING, RIBBON_RIDGE, SKY_HOP } from "./extra-courses"
import { type Stage, windingCourse } from "./route-builders"
import type { CourseDefinition } from "./types"

function palette(course: CourseDefinition) {
  if (course.theme === undefined) throw new Error("Missing course palette")
  return course.theme
}
const cloud = palette(SKY_HOP),
  factory = palette(CLOCKWORK_CROSSING),
  canyon = palette(RIBBON_RIDGE)

/** No ramp or stepping stones reach the six/seven-metre upper dock. */
function lift(height: number, left: boolean): Stage {
  const side = left ? -1 : 1
  return {
    hint: `Board the lift · ride ${height} metres up · leave at the upper dock`,
    roads: [
      {
        points: [
          [0, 0, 0],
          [0, 0, 6],
          [0, 0, 11],
          [0, height, 16],
          [side * 8, height, 24],
          [side * 8, 0, 38],
          [0, 0, 47],
        ],
        gaps: [2, 3],
        omitLandings: [2],
        rides: [{ exitIndex: 3, moverHazardIndex: 0 }],
        width: 4.6,
      },
    ],
    hazards: [
      {
        kind: "ferry",
        from: [0, 0, 11],
        to: [0, height, 11],
        size: 3,
        halfDepth: 2.6,
        travelSec: 3.4,
        dwellSec: 1.7,
      },
    ],
  }
}

const shutter: readonly Stage[] = [
  {
    hint: "The arrows pull sideways while the shutter is closed · countersteer and hop for green",
    roads: [
      {
        points: [
          [0, 0, 0],
          [0, 0, 9],
          [0, 0, 21],
          [0, 0, 31],
        ],
        width: 6.4,
      },
    ],
    hazards: [
      { kind: "belt", from: [0, 0, 9], to: [0, 0, 17.3], width: 6.4, speed: 0, sideSpeed: -3.2 },
      { kind: "gate", at: [0, 0, 17.5], width: 7.4, periodSec: 7.2, openSec: 3.6 },
    ],
  },
  {
    hint: "Short island jumps or a wide boosted loop · clean jumps save the detour",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-7, 0, 9],
          [-12, 0, 17],
          [-12, 0, 31],
          [0, 0, 42],
        ],
        width: 5.2,
      },
      {
        points: [
          [0, 0, 0],
          [5, 0, 8],
          [5, 0, 15],
          [5, 0, 22],
          [0, 0, 42],
        ],
        width: 3.8,
        gaps: [2, 3],
      },
    ],
    hazards: [{ kind: "belt", from: [-12, 0, 18], to: [-12, 0, 30], width: 4.5, speed: 4.5 }],
  },
]

const transfer: readonly Stage[] = [
  lift(6, true),
  {
    hint: "Diagonal sky ferry or narrow island vaults · the wide ferry takes longer",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-7, 0, 8],
          [-7, 0, 13],
          [-13, 0, 28],
          [0, 0, 39],
        ],
        width: 4.6,
        gaps: [2, 3],
        omitLandings: [2],
        rides: [{ exitIndex: 3, moverHazardIndex: 0 }],
      },
      {
        points: [
          [0, 0, 0],
          [6, 0, 8],
          [6, 0, 14],
          [6, 0, 20],
          [6, 0, 26],
          [0, 0, 39],
        ],
        width: 3.8,
        gaps: [2, 3, 4],
      },
    ],
    hazards: [
      {
        kind: "ferry",
        from: [-7, 0, 13],
        to: [-13, 0, 23],
        size: 3,
        halfDepth: 2.6,
        travelSec: 7,
        dwellSec: 1.3,
      },
    ],
  },
]

const pendulum: readonly Stage[] = [
  {
    hint: "Ride the sideways express or jump the thin sky causeway · both meet at a spinner",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-8, 0, 8],
          [-8, 0, 13],
          [8, 0, 20.1],
          [8, 0, 30],
          [0, 0, 42],
        ],
        width: 4.6,
        gaps: [2, 3],
        omitLandings: [2],
        rides: [{ exitIndex: 3, moverHazardIndex: 0 }],
      },
      {
        points: [
          [0, 0, 0],
          [0, 3.4, 9],
          [0, 3.4, 15],
          [0, 3.4, 21],
          [8, 0, 30],
          [0, 0, 42],
        ],
        width: 3.4,
        gaps: [2, 3],
      },
    ],
    hazards: [
      {
        kind: "ferry",
        from: [-8, 0, 13],
        to: [8, 0, 15],
        size: 3,
        halfDepth: 2.6,
        travelSec: 6.9,
        dwellSec: 1.5,
      },
      { kind: "bar", at: [8, 0, 31], width: 12, speed: 135 },
    ],
  },
  {
    hint: "Jump out of the reverse belt or balance on the boost · meet at a full-width shutter",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-9, 0, 10],
          [-9, 0, 25],
          [-3, 0, 19],
          [4, 0, 32],
          [0, 0, 43],
          [0, 0, 56],
        ],
        width: 5.2,
      },
      {
        points: [
          [0, 0, 0],
          [8, 0, 9],
          [3, 0, 22],
          [8, 0, 33],
          [0, 0, 43],
          [0, 0, 56],
        ],
        width: 3.2,
      },
    ],
    hazards: [
      { kind: "belt", from: [-9, 0, 11], to: [-9, 0, 24], width: 3.2, speed: -3 },
      { kind: "belt", from: [8, 0, 10], to: [3, 0, 21], width: 2.6, speed: 4 },
      { kind: "gate", at: [0, 0, 49], width: 6.2, periodSec: 5.5, openSec: 2.8 },
    ],
  },
]

export const MECHANISM_COURSES: readonly CourseDefinition[] = [
  windingCourse(
    "lift-lock",
    "Lift Lock",
    "Two mandatory elevator climbs: board low, ride high, then negotiate opposite sky bends.",
    "Medium",
    factory,
    [lift(6, false), lift(7, true)],
  ),
  windingCourse(
    "shutter-shuttle",
    "Shutter Shuttle",
    "Countersteer and hop on an arrow-marked conveyor while the gate cycles, then choose a boosted loop or island vaults.",
    "Tricky",
    factory,
    shutter,
  ),
  windingCourse(
    "sky-transfer",
    "Sky Transfer",
    "An essential elevator followed by a diagonal express ferry versus a thin chain of jump islands.",
    "Tricky",
    cloud,
    transfer,
  ),
  windingCourse(
    "pendulum-pier",
    "Pendulum Pier",
    "A rapid sideways ferry, risky causeway jumps and a reverse counterflow bend with a boosted escape.",
    "Tricky",
    canyon,
    pendulum,
  ),
]
