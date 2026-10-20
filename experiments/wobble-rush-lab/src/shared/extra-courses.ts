import { assembleCourse } from "./course-sections"

export const SKY_HOP = assembleCourse(
  "sky-hop",
  "Sky Hop",
  "Floating islands, drifting ferries and a climb into the clouds.",
  "Medium",
  {
    skyTop: "#72b7ee",
    skyHorizon: "#e6f7ff",
    deck: "#89dcec",
    accent: "#c1afff",
    rest: "#fff2ad",
    landmark: "clouds",
  },
  ["hops", "steps", "hops", "ribbon"],
)

export const BUMPER_BOULEVARD = assembleCourse(
  "bumper-boulevard",
  "Bumper Boulevard",
  "A candy-coloured slalom: find your line, bounce back and overtake.",
  "Easy",
  {
    skyTop: "#ef91c0",
    skyHorizon: "#fff2d8",
    deck: "#ffb7ce",
    accent: "#ea728e",
    rest: "#99e8c0",
    landmark: "candy",
  },
  ["slalom", "belts", "slalom", "sweepers", "slalom"],
)

export const CLOCKWORK_CROSSING = assembleCourse(
  "clockwork-crossing",
  "Clockwork Crossing",
  "Watch the gate lights and ride the conveyor arrows through the factory.",
  "Medium",
  {
    skyTop: "#586c94",
    skyHorizon: "#f4d39b",
    deck: "#87b6be",
    accent: "#ffb35c",
    rest: "#b8edcf",
    landmark: "factory",
  },
  ["belts", "gates", "crossers", "gates", "belts"],
)

export const RIBBON_RIDGE = assembleCourse(
  "ribbon-ridge",
  "Ribbon Ridge",
  "Winding bridges, lookout steps and island jumps above a warm canyon.",
  "Tricky",
  {
    skyTop: "#cb9fd6",
    skyHorizon: "#ffe4b5",
    deck: "#dfab88",
    accent: "#ffc46a",
    rest: "#c3baf1",
    landmark: "canyon",
  },
  ["ribbon", "steps", "ribbon", "hops", "ribbon"],
)

export const FESTIVAL_FINALE = assembleCourse(
  "festival-finale",
  "Festival Finale",
  "The big parade: spinning bars, jumps, gates, belts and a final ridge.",
  "Tricky",
  {
    skyTop: "#7662af",
    skyHorizon: "#ffc6ce",
    deck: "#a99aee",
    accent: "#ffd55e",
    rest: "#7fdfcb",
    landmark: "festival",
  },
  ["sweepers", "hops", "gates", "slalom", "belts", "steps", "ribbon"],
)
