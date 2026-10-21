/** Authored topologies: the common builder lays roads, not interchangeable lanes. */
import {
  BUMPER_BOULEVARD,
  CLOCKWORK_CROSSING,
  FESTIVAL_FINALE,
  RIBBON_RIDGE,
  SKY_HOP,
} from "./extra-courses"
import { type Stage, windingCourse } from "./route-builders"
import type { CourseDefinition, CourseTheme } from "./types"

function palette(course: CourseDefinition): CourseTheme {
  if (course.theme === undefined) throw new Error("Missing course palette")
  return course.theme
}
const cloud = palette(SKY_HOP),
  factory = palette(CLOCKWORK_CROSSING),
  candy = palette(BUMPER_BOULEVARD),
  canyon = palette(RIBBON_RIDGE),
  festival = palette(FESTIVAL_FINALE)
const cloudline: readonly Stage[] = [
  {
    hint: "Wide low zigzag has a spinner · narrow high bridge avoids it",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-7, 0, 8],
          [-7, 0, 18],
          [7, 0, 30],
          [7, 0, 42],
          [0, 0, 54],
        ],
      },
      {
        points: [
          [0, 0, 0],
          [7, 0, 8],
          [7, 3.4, 19],
          [-7, 3.4, 31],
          [-7, 0, 44],
          [0, 0, 54],
        ],
        width: 3.8,
      },
    ],
    hazards: [
      {
        kind: "bar",
        at: [7, 0, 37],
        width: 4.6,
      },
    ],
  },
  {
    hint: "Longer gated loop or shorter spinning road · jump-dive across",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-4.6, 0, 8],
          [-4.6, 0, 24],
          [-12, 0, 32],
          [-6, 0, 44],
          [0, 0, 54],
        ],
      },
      {
        points: [
          [0, 0, 0],
          [4.6, 0, 8],
          [4.6, 0, 24],
          [10, 0, 34],
          [3, 0, 45],
          [0, 0, 54],
        ],
      },
    ],
    hazards: [
      {
        kind: "gate",
        at: [-4.6, 0, 20],
        width: 4.6,
      },
      {
        kind: "bar",
        at: [10, 0, 34],
        width: 4.6,
        speed: 100,
      },
    ],
    cuts: [
      {
        from: [-2.6, 0, 16],
        to: [2.6, 0, 19],
        dive: true,
      },
    ],
  },
]
const canopy: readonly Stage[] = [
  {
    hint: "Wide calm road or narrow boosted road · both meet at the spinner",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-8, 0, 7],
          [-12, 0, 19],
          [0, 0, 28],
          [10, 0, 37],
          [0, 0, 54],
        ],
        width: 5.2,
      },
      {
        points: [
          [0, 0, 0],
          [9, 0, 8],
          [12, 0, 18],
          [0, 0, 28],
          [-10, 0, 40],
          [0, 0, 54],
        ],
        width: 3.6,
      },
    ],
    hazards: [
      {
        kind: "bar",
        at: [0, 0, 28],
        width: 6,
        speed: 75,
      },
      {
        kind: "belt",
        from: [9.6, 0, 10],
        to: [11.4, 0, 16],
        width: 2.8,
        speed: 3.2,
      },
    ],
  },
  {
    hint: "Long wide hairpin gets a boost · short outside road has two shutters",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-8, 0, 10],
          [-8, 0, 30],
          [5, 0, 30],
          [5, 0, 20],
          [13, 0, 20],
          [13, 0, 44],
          [0, 0, 56],
        ],
        width: 4.8,
      },
      {
        points: [
          [0, 0, 0],
          [4, 0, 7],
          [17, 0, 12],
          [20, 0, 35],
          [12, 0, 47],
          [0, 0, 56],
        ],
        width: 3.8,
      },
    ],
    hazards: [
      {
        kind: "belt",
        from: [-8, 0, 13],
        to: [-8, 0, 27],
        width: 4,
        speed: 4.2,
      },
      {
        kind: "gate",
        at: [18.5, 0, 23.5],
        width: 3.8,
        yaw: 0.1297025371559121,
        phase: 0,
        periodSec: 5.4,
        openSec: 2.7,
      },
      {
        kind: "gate",
        at: [16, 0, 41],
        width: 3.8,
        yaw: -0.5880026035475675,
        phase: 2.1,
        periodSec: 5.4,
        openSec: 2.7,
      },
    ],
  },
]
const turbo: readonly Stage[] = [
  {
    hint: "Turn with the belts · dive from a straight launch, not a corner",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-9, 0, 8],
          [-9, 0, 20],
          [7, 0, 20],
          [7, 0, 36],
          [-6, 0, 36],
          [0, 0, 54],
        ],
        width: 5.2,
      },
      {
        points: [
          [0, 0, 0],
          [10, 0, 8],
          [16, 0, 24],
          [16, 0, 42],
          [0, 0, 54],
        ],
        width: 3.8,
      },
    ],
    hazards: [
      {
        kind: "belt",
        from: [-7, 0, 20],
        to: [4, 0, 20],
        width: 4.2,
        speed: 4.8,
      },
      {
        kind: "belt",
        from: [7, 0, 25],
        to: [7, 0, 32],
        width: 4.2,
        speed: 3.8,
      },
      {
        kind: "gate",
        at: [16, 0, 33],
        width: 3.8,
      },
    ],
  },
  {
    hint: "Fast inside chicane or broad outside loop",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-10, 0, 10],
          [-10, 0, 24],
          [7, 0, 34],
          [7, 0, 44],
          [0, 0, 56],
        ],
      },
      {
        points: [
          [0, 0, 0],
          [10, 0, 10],
          [10, 0, 22],
          [-7, 0, 32],
          [-7, 0, 44],
          [0, 0, 56],
        ],
      },
    ],
    hazards: [
      {
        kind: "belt",
        from: [-10, 0, 13],
        to: [-10, 0, 21],
        width: 3.8,
        speed: 4.5,
      },
      {
        kind: "bar",
        at: [7, 0, 40],
        width: 4.6,
        speed: -120,
      },
    ],
  },
]
const switchyard: readonly Stage[] = [
  {
    hint: "Wide counterflow track is calm · narrow boosted track is quicker but risky",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-10, 0, 8],
          [10, 0, 25],
          [-10, 0, 42],
          [0, 0, 58],
        ],
        width: 5.2,
      },
      {
        points: [
          [0, 0, 0],
          [10, 0, 8],
          [-10, 0, 25],
          [10, 0, 42],
          [0, 0, 58],
        ],
        width: 3.6,
      },
    ],
    hazards: [
      {
        kind: "ferry",
        from: [-2.5, 0.5, 16],
        to: [2.5, 0.5, 17],
        size: 0.8,
        halfHeight: 0.2,
      },
      {
        kind: "ferry",
        from: [2.5, 0.5, 33],
        to: [-2.5, 0.5, 34],
        size: 0.8,
        halfHeight: 0.2,
      },
      {
        kind: "belt",
        from: [-7.5, 0, 10.125],
        to: [7.5, 0, 22.875],
        width: 4.2,
        speed: -2.2,
      },
      { kind: "belt", from: [7.5, 0, 10.125], to: [-7.5, 0, 22.875], width: 2.8, speed: 3.2 },
    ],
  },
  {
    hint: "Centre is short but gated · left boosts past a bar · right is a calm detour",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-10, 0, 8],
          [-10, 0, 38],
          [0, 0, 54],
        ],
      },
      {
        points: [
          [0, 0, 0],
          [0, 0, 12],
          [0, 0, 38],
          [0, 0, 54],
        ],
        width: 3.6,
      },
      {
        points: [
          [0, 0, 0],
          [10, 0, 8],
          [10, 0, 38],
          [0, 0, 54],
        ],
        width: 5.2,
      },
    ],
    hazards: [
      {
        kind: "gate",
        at: [0, 0, 24],
        width: 3.6,
        phase: 2.5,
      },
      {
        kind: "bar",
        at: [-10, 0, 28],
        width: 4.6,
        speed: 90,
      },
      {
        kind: "belt",
        from: [-10, 0, 12],
        to: [-10, 0, 34],
        width: 3.8,
        speed: 3.5,
      },
    ],
  },
]
const sugar: readonly Stage[] = [
  {
    hint: "Long broad loop is safe · inside islands save distance if you land the hops",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-10, 0, 8],
          [-16, 0, 19],
          [-10, 0, 32],
          [4, 0, 32],
          [12, 0, 42],
          [0, 0, 56],
        ],
        width: 5,
      },
      {
        points: [
          [0, 0, 0],
          [5, 0, 8],
          [5, 0, 15],
          [5, 0, 22],
          [5, 0, 29],
          [12, 0, 42],
          [0, 0, 56],
        ],
        width: 4,
        gaps: [2, 3, 4],
      },
    ],
    hazards: [
      {
        kind: "belt",
        from: [-8, 0, 32],
        to: [2, 0, 32],
        width: 4.2,
        speed: 3.8,
      },
    ],
  },
  {
    hint: "Wide counterflow curve or narrow boosted curve · meet at the shutter",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-9, 0, 9],
          [-12, 0, 20],
          [0, 0, 29],
          [12, 0, 38],
          [9, 0, 47],
          [0, 0, 58],
        ],
        width: 5.4,
      },
      {
        points: [
          [0, 0, 0],
          [9, 0, 9],
          [12, 0, 20],
          [0, 0, 29],
          [-12, 0, 38],
          [-9, 0, 47],
          [0, 0, 58],
        ],
        width: 3.6,
      },
    ],
    hazards: [
      {
        kind: "gate",
        at: [0, 0, 29],
        width: 5.2,
      },
      {
        kind: "belt",
        from: [-9.6, 0, 21.8],
        to: [-2.4, 0, 27.2],
        width: 4.4,
        speed: -2.2,
      },
      {
        kind: "belt",
        from: [9.6, 0, 21.8],
        to: [2.4, 0, 27.2],
        width: 2.8,
        speed: 2.5,
      },
    ],
  },
]
const canyonStages: readonly Stage[] = [
  {
    hint: "Long wide hairpin gets a boost · direct ridge is narrow, spinning and gated",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-10, 0, 9],
          [-10, 0, 35],
          [5, 0, 35],
          [5, 0, 22],
          [14, 0, 22],
          [14, 0, 47],
          [0, 0, 60],
        ],
        width: 5.4,
      },
      {
        points: [
          [0, 0, 0],
          [8, 0, 8],
          [8, 3.4, 22],
          [-7, 3.4, 35],
          [-7, 0, 48],
          [0, 0, 60],
        ],
        width: 3.2,
      },
    ],
    hazards: [
      {
        kind: "belt",
        from: [-10, 0, 12],
        to: [-10, 0, 32],
        width: 4.4,
        speed: 3.4,
      },
      {
        kind: "gate",
        at: [0.5, 3.4, 28.5],
        width: 3.2,
        yaw: -0.8567056281827387,
        phase: 1.4,
        periodSec: 5.4,
        openSec: 2.7,
      },
      {
        kind: "bar",
        at: [8, 3.4, 22],
        width: 3.2,
        speed: 95,
      },
    ],
  },
  {
    hint: "Wide low road has a spinner · narrow high ridge avoids the bar",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-9, 0, 9],
          [-9, 0, 24],
          [9, 0, 35],
          [9, 0, 46],
          [0, 0, 60],
        ],
        width: 5.2,
      },
      {
        points: [
          [0, 0, 0],
          [9, 0, 9],
          [9, 3.6, 24],
          [-9, 3.6, 35],
          [-9, 0, 47],
          [0, 0, 60],
        ],
        width: 3.2,
      },
    ],
    hazards: [
      {
        kind: "bar",
        at: [-9, 0, 18],
        width: 5.2,
        speed: 105,
      },
    ],
  },
]
const triple: readonly Stage[] = [
  {
    hint: "Three approaches converge · change roads at the junction",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-12, 0, 10],
          [-12, 0, 25],
          [0, 0, 34],
          [0, 0, 54],
        ],
        width: 5,
      },
      {
        points: [
          [0, 0, 0],
          [12, 0, 10],
          [12, 0, 25],
          [0, 0, 34],
          [0, 0, 54],
        ],
        width: 5,
      },
      {
        points: [
          [0, 0, 0],
          [0, 0, 8],
          [0, 0, 15],
          [0, 0, 22],
          [0, 0, 29],
          [0, 0, 34],
          [0, 0, 54],
        ],
        width: 4.4,
        gaps: [2, 3, 4],
      },
    ],
    hazards: [
      {
        kind: "gate",
        at: [0, 0, 44],
        width: 5,
      },
    ],
  },
  {
    hint: "Three exits peel away from a triangular junction",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-10, 0, 10],
          [-15, 0, 28],
          [-8, 0, 43],
          [0, 0, 58],
        ],
        width: 4.8,
      },
      {
        points: [
          [0, 0, 0],
          [10, 0, 10],
          [15, 0, 28],
          [8, 0, 43],
          [0, 0, 58],
        ],
        width: 4.8,
      },
      {
        points: [
          [0, 0, 0],
          [0, 0, 12],
          [5, 0, 23],
          [-5, 0, 34],
          [0, 0, 46],
          [0, 0, 58],
        ],
        width: 3.6,
      },
    ],
    hazards: [
      {
        kind: "bar",
        at: [0, 0, 46],
        width: 3.6,
        speed: -110,
      },
    ],
  },
]
const harbor: readonly Stage[] = [
  {
    hint: "Shore shutter is safe to wait for · ferry islands reward clean jumps",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-12, 0, 9],
          [-16, 0, 24],
          [-10, 0, 42],
          [0, 0, 58],
        ],
        width: 5,
      },
      {
        points: [
          [0, 0, 0],
          [5, 0, 9],
          [10, 0, 14],
          [5, 0, 20],
          [10, 0, 26],
          [5, 0, 32],
          [10, 0, 38],
          [0, 0, 58],
        ],
        width: 4.8,
        gaps: [2, 3, 4, 5, 6],
      },
    ],
    hazards: [
      {
        kind: "ferry",
        from: [8.5, 0.85, 9],
        to: [13.5, 0.85, 14],
        size: 1.5,
      },
      {
        kind: "gate",
        at: [-14, 0, 16.5],
        width: 5,
        yaw: Math.atan2(-4, 15),
        phase: 0,
        periodSec: 8,
        openSec: 2.4,
      },
      {
        kind: "ferry",
        from: [13.5, 0.85, 26],
        to: [8.5, 0.85, 30],
        size: 1.5,
      },
      {
        kind: "ferry",
        from: [8.5, 0.85, 34],
        to: [13.5, 0.85, 38],
        size: 1.5,
      },
    ],
  },
  {
    hint: "Long boosted dock is calm · short high pier is narrow, spinning and gated",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-10, 0, 10],
          [-10, 0, 34],
          [5, 0, 34],
          [5, 0, 24],
          [14, 0, 24],
          [14, 0, 46],
          [0, 0, 60],
        ],
        width: 4.8,
      },
      {
        points: [
          [0, 0, 0],
          [9, 0, 8],
          [9, 3.4, 20],
          [-7, 3.4, 32],
          [-7, 0, 47],
          [0, 0, 60],
        ],
        width: 3.2,
      },
    ],
    spurs: [
      {
        points: [
          [-7, 3.4, 32],
          [-11, 3.4, 32],
        ],
        width: 3.2,
      },
    ],
    hazards: [
      {
        kind: "ferry",
        from: [-14.4, 0, 32],
        to: [-14.4, 3.4, 32],
        size: 1.6,
      },
      {
        kind: "belt",
        from: [14, 0, 28],
        to: [14, 0, 43],
        width: 4,
        speed: 3.5,
      },
      {
        kind: "gate",
        at: [1, 3.4, 26],
        width: 3.2,
        yaw: -0.9272952180016122,
        phase: 1.8,
        periodSec: 5.4,
        openSec: 2.7,
      },
      {
        kind: "bar",
        at: [9, 3.4, 20],
        width: 3.2,
        speed: 90,
      },
    ],
  },
]
const terrace: readonly Stage[] = [
  {
    hint: "Wide upper braid avoids waiting · narrow lower road has a shutter",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-8, 0, 8],
          [-8, 3.6, 21],
          [8, 3.6, 34],
          [8, 0, 48],
          [0, 0, 62],
        ],
        width: 5.2,
      },
      {
        points: [
          [0, 0, 0],
          [8, 0, 8],
          [8, 0, 21],
          [-8, 0, 34],
          [-8, 0, 48],
          [0, 0, 62],
        ],
        width: 3.6,
      },
    ],
    hazards: [
      {
        kind: "gate",
        at: [8, 0, 15],
        width: 3.6,
        yaw: 0,
        phase: 1.7,
        periodSec: 5.4,
        openSec: 2.7,
      },
    ],
  },
  {
    hint: "Wide low road faces a bar · high narrow road trades the spinner for a climb",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-9, 0, 9],
          [-9, 0, 24],
          [9, 0, 36],
          [9, 0, 49],
          [0, 0, 62],
        ],
        width: 5,
      },
      {
        points: [
          [0, 0, 0],
          [9, 0, 9],
          [9, 3.8, 24],
          [-9, 3.8, 36],
          [-9, 0, 49],
          [0, 0, 62],
        ],
        width: 3.8,
      },
    ],
    hazards: [
      {
        kind: "bar",
        at: [9, 0, 43],
        width: 5,
        speed: -105,
      },
    ],
  },
]
const finale: readonly Stage[] = [
  {
    hint: "Short narrow outer sweep or longer wide boosted switchback with a gate",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-12, 0, 8],
          [-18, 0, 24],
          [-12, 0, 44],
          [0, 0, 60],
        ],
        width: 3.8,
      },
      {
        points: [
          [0, 0, 0],
          [5, 0, 9],
          [5, 0, 25],
          [-5, 0, 25],
          [-5, 0, 39],
          [5, 0, 39],
          [0, 0, 60],
        ],
        width: 5,
      },
    ],
    hazards: [
      {
        kind: "bar",
        at: [-18, 0, 24],
        width: 3.8,
        speed: 125,
      },
      {
        kind: "gate",
        at: [5, 0, 19],
        width: 5,
      },
      {
        kind: "belt",
        from: [3, 0, 25],
        to: [-3, 0, 25],
        width: 4,
        speed: 4,
      },
    ],
  },
  {
    hint: "Upper bridge crosses the fast belt · choose your last turn",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-10, 0, 9],
          [-10, 0, 23],
          [10, 0, 37],
          [10, 0, 49],
          [0, 0, 64],
        ],
        width: 5,
      },
      {
        points: [
          [0, 0, 0],
          [10, 0, 9],
          [10, 3.6, 23],
          [-10, 3.6, 37],
          [-10, 0, 49],
          [0, 0, 64],
        ],
        width: 3.8,
      },
    ],
    hazards: [
      {
        kind: "belt",
        from: [-6, 0, 25.8],
        to: [6, 0, 34.2],
        width: 4,
        speed: 3.8,
      },
      {
        kind: "bar",
        at: [10, 0, 44],
        width: 5,
        speed: -135,
      },
    ],
  },
]
const spiral: readonly Stage[] = [
  {
    hint: "Ground road ends at the elevator · wide boosted spiral climbs without waiting",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-15, 0, 10],
          [-19, 0, 28],
          [-15, 0, 46],
          [2, 0, 42],
          [4, 0, 38.4],
          [6, 4, 42],
          [9, 4, 42],
          [0, 0, 62],
        ],
        width: 3.8,
        // The former ground exit is gone: board the lift and leave on the upper pier.
        gaps: [5, 6],
        omitLandings: [5],
        rides: [{ exitIndex: 6, moverHazardIndex: 0 }],
      },
      {
        points: [
          [0, 0, 0],
          [8, 0, 8],
          [14, 0.8, 18],
          [14, 1.6, 34],
          [0, 2.4, 34],
          [0, 3.2, 18],
          [9, 4, 18],
          [9, 4, 42],
          [0, 0, 62],
        ],
        width: 5.4,
      },
    ],
    hazards: [
      {
        kind: "ferry",
        from: [4, 0, 38.4],
        to: [4, 4, 38.4],
        size: 1.6,
      },
      {
        kind: "gate",
        at: [-17, 0, 19],
        width: 3.8,
        yaw: -0.21866894587394195,
        phase: 0,
        periodSec: 8,
        openSec: 2.4,
      },
      {
        kind: "gate",
        at: [-17, 0, 37],
        width: 3.8,
        yaw: 0.21866894587394195,
        phase: 4,
        periodSec: 8,
        openSec: 2.4,
      },
      {
        kind: "belt",
        from: [9, 4, 22],
        to: [9, 4, 39],
        width: 4.4,
        speed: 5,
      },
    ],
  },
  {
    hint: "Wide left road has a spinner · right road trades the bar for island jumps",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-10, 0, 8],
          [-14, 0, 24],
          [-6, 0, 40],
          [0, 0, 54],
        ],
        width: 5.2,
      },
      {
        points: [
          [0, 0, 0],
          [10, 0, 8],
          [14, 0, 16],
          [14, 0, 23],
          [14, 0, 30],
          [6, 0, 40],
          [0, 0, 54],
        ],
        width: 4.4,
        gaps: [3, 4],
      },
    ],
    hazards: [
      {
        kind: "bar",
        at: [-14, 0, 24],
        width: 5.2,
        speed: 95,
      },
    ],
  },
]
const vault: readonly Stage[] = [
  {
    hint: "Wide boosted loop is safe · short island road demands repeated jumps",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-10, 0, 8],
          [-15, 0, 24],
          [-10, 0, 42],
          [0, 0, 58],
        ],
        width: 5,
      },
      {
        points: [
          [0, 0, 0],
          [5, 0, 8],
          [5, 0, 15],
          [5, 0, 22],
          [5, 0, 29],
          [5, 0, 36],
          [5, 0, 43],
          [0, 0, 58],
        ],
        width: 4,
        gaps: [2, 3, 4, 5, 6],
      },
    ],
    hazards: [
      {
        kind: "belt",
        from: [-14, 0, 27.6],
        to: [-11, 0, 38.4],
        width: 4,
        speed: 3.2,
      },
    ],
  },
  {
    hint: "Closed gate? Jump and dive to the opposite bypass",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-4.6, 0, 8],
          [-4.6, 0, 30],
          [-10, 0, 40],
          [0, 0, 56],
        ],
        width: 4.6,
      },
      {
        points: [
          [0, 0, 0],
          [4.6, 0, 8],
          [4.6, 0, 30],
          [10, 0, 40],
          [0, 0, 56],
        ],
        width: 4.6,
      },
    ],
    hazards: [
      {
        kind: "gate",
        at: [-4.6, 0, 23],
        width: 4.6,
        phase: 3,
      },
      {
        kind: "gate",
        at: [4.6, 0, 15],
        width: 4.6,
      },
    ],
    cuts: [
      {
        from: [-2.6, 0, 18],
        to: [2.6, 0, 22],
        dive: true,
      },
      {
        from: [2.6, 0, 10],
        to: [-2.6, 0, 14],
        dive: true,
      },
    ],
  },
]
const tide: readonly Stage[] = [
  {
    hint: "Wide boost road has a shuttle · shorter counterflow road rewards jumping",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-10, 0, 10],
          [-10, 0, 26],
          [6, 0, 38],
          [6, 0, 48],
          [0, 0, 60],
        ],
        width: 5.4,
      },
      {
        points: [
          [0, 0, 0],
          [10, 0, 10],
          [16, 0, 25],
          [12, 0, 44],
          [0, 0, 60],
        ],
        width: 3.8,
      },
    ],
    hazards: [
      {
        kind: "belt",
        from: [-10, 0, 14],
        to: [-10, 0, 23],
        width: 4.4,
        speed: 3.4,
      },
      {
        kind: "ferry",
        from: [2, 0.45, 43],
        to: [10, 0.45, 43],
        size: 0.8,
        halfHeight: 0.2,
      },
      {
        kind: "belt",
        from: [15.37, 0, 28],
        to: [12.84, 0, 40],
        width: 3,
        speed: -3.4,
      },
    ],
  },
  {
    hint: "Long boosted zigzag with a gate · short wider ridge resists your run",
    roads: [
      {
        points: [
          [0, 0, 0],
          [-12, 0, 12],
          [6, 0, 27],
          [6, 0, 40],
          [-6, 0, 40],
          [0, 0, 58],
        ],
        width: 5.2,
      },
      {
        points: [
          [0, 0, 0],
          [12, 0, 12],
          [16, 0, 30],
          [12, 0, 46],
          [0, 0, 58],
        ],
        width: 4.8,
      },
    ],
    hazards: [
      {
        kind: "belt",
        from: [-9, 0, 14.5],
        to: [3, 0, 24.5],
        width: 4.2,
        speed: 4.6,
      },
      {
        kind: "gate",
        at: [6, 0, 35],
        width: 5.2,
      },
      {
        kind: "belt",
        from: [15.5, 0, 32],
        to: [12.5, 0, 44],
        width: 3.8,
        speed: -2,
      },
    ],
  },
]
/** Authored section roads are exposed for reproducible route timing audits. */
export const COURSE_STAGES: Readonly<Record<string, readonly Stage[]>> = {
  "cloudline-fork": cloudline,
  "canopy-switch": canopy,
  "twin-turbo": turbo,
  "switchyard-shuffle": switchyard,
  "sugar-skyways": sugar,
  "canyon-choices": canyonStages,
  "triple-junction": triple,
  "harbor-hoppers": harbor,
  "terrace-tangle": terrace,
  "finale-freeways": finale,
  "spiral-summit": spiral,
  "vault-or-wait": vault,
  "tidal-twist": tide,
}
export const CREATIVE_COURSES: readonly CourseDefinition[] = [
  windingCourse(
    "cloudline-fork",
    "Cloudline Fork",
    "A sky bridge crosses a low zigzag; jump-dive past the second gate.",
    "Medium",
    cloud,
    cloudline,
  ),
  windingCourse(
    "canopy-switch",
    "Canopy Switch",
    "Cross at the clearing, then follow a backwards-facing forest hairpin.",
    "Easy",
    cloud,
    canopy,
  ),
  windingCourse(
    "twin-turbo",
    "Twin Turbo",
    "Sideways speed strips, chicanes and an outer gate road reward clean cornering.",
    "Medium",
    factory,
    turbo,
  ),
  windingCourse(
    "switchyard-shuffle",
    "Switchyard Shuffle",
    "An X-shaped rail yard, diagonal shuttles and three shutter approaches.",
    "Medium",
    factory,
    switchyard,
  ),
  windingCourse(
    "sugar-skyways",
    "Sugar Skyways",
    "Curl around candy islands, then choose either half of a figure-eight junction.",
    "Easy",
    candy,
    sugar,
  ),
  windingCourse(
    "canyon-choices",
    "Canyon Choices",
    "Backwards hairpins beneath elevated canyon bridges; narrow roads save distance.",
    "Tricky",
    canyon,
    canyonStages,
  ),
  windingCourse(
    "triple-junction",
    "Triple Junction",
    "A triangle, a true meeting point and a slalom exit offer three distinct roads.",
    "Medium",
    festival,
    triple,
  ),
  windingCourse(
    "harbor-hoppers",
    "Harbor Hoppers",
    "Diagonal ferry hops, a winding shore and a lift between dock and sky pier.",
    "Medium",
    cloud,
    harbor,
  ),
  windingCourse(
    "terrace-tangle",
    "Terrace Tangle",
    "Two braids swap which road goes over and under; drop between levels if you dare.",
    "Medium",
    canyon,
    terrace,
  ),
  windingCourse(
    "finale-freeways",
    "Finale Freeways",
    "A festival loop, gated switchback, diagonal speed strip and high crossing finale.",
    "Tricky",
    festival,
    finale,
  ),
  windingCourse(
    "spiral-summit",
    "Spiral Summit",
    "Climb the boosted corkscrew or take the shuttered ground road to its required elevator.",
    "Tricky",
    cloud,
    spiral,
  ),
  windingCourse(
    "vault-or-wait",
    "Vault or Wait",
    "Island vaults and jump-dive gate escapes trade safe waiting for a risky fast line.",
    "Tricky",
    factory,
    vault,
  ),
  windingCourse(
    "tidal-twist",
    "Tidal Twist",
    "Fight the counterflow, jump out of the belt, then handle a diagonal launch and reverse turn.",
    "Medium",
    candy,
    tide,
  ),
]
