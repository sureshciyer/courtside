export const SHOT_CODES = {
  rear: [
    { code: "SM", label: "Smash", color: "#c62828" },
    { code: "HS", label: "Half-Smash", color: "#c62828" },
    { code: "DR", label: "Drop", color: "#c62828" },
    { code: "SL", label: "Slice", color: "#c62828" },
    { code: "CL", label: "Clear", color: "#c62828" },
  ],
  mid: [
    { code: "DV", label: "Drive", color: "#e65100" },
    { code: "PS", label: "Push", color: "#e65100" },
    { code: "LF", label: "Lift", color: "#e65100" },
    { code: "BL", label: "Block", color: "#e65100" },
  ],
  front: [
    { code: "NT", label: "Net", color: "#0d47a1" },
    { code: "KL", label: "Kill", color: "#0d47a1" },
    { code: "LB", label: "Lob", color: "#0d47a1" },
  ],
  serve: [
    { code: "LS", label: "Low Serve", color: "#6a1b9a" },
    { code: "FS", label: "Flick Serve", color: "#6a1b9a" },
    { code: "DS", label: "Drive Serve", color: "#6a1b9a" },
  ],
};

export const GRIPS = [
  { code: "F", label: "Forehand" },
  { code: "B", label: "Backhand" },
];

export const DIRS = [
  { code: "ST", label: "Straight" },
  { code: "CR", label: "Cross" },
  { code: "BD", label: "Body" },
];

export const ZONES = [
  { n: 1, l: "Front L" }, { n: 2, l: "T-Junc" }, { n: 3, l: "Front R" },
  { n: 4, l: "Mid L" },   { n: 5, l: "Body" },   { n: 6, l: "Mid R" },
  { n: 7, l: "Back L" },  { n: 8, l: "Back C" }, { n: 9, l: "Back R" },
];

export const ROLES = [
  { code: "opening",    label: "Opening",    bg: "#e3f2fd", c: "#0d47a1" },
  { code: "neutral",    label: "Neutral",    bg: "#f5f5f5", c: "#78909c" },
  { code: "disruption", label: "Disruption", bg: "#fff3e0", c: "#e65100" },
  { code: "finish",     label: "Finish",     bg: "#ffebee", c: "#b71c1c" },
];

const ROLE_COLORS = {
  opening:    ["#e3f2fd", "#0d47a1"],
  disruption: ["#fff3e0", "#e65100"],
  finish:     ["#ffebee", "#b71c1c"],
  neutral:    ["#f5f5f5", "#78909c"],
};

export const roleColor = (r) => ROLE_COLORS[r] || ROLE_COLORS.neutral;

// Shots that are high-impact disruption/pressure plays. Used by autoRole to
// suggest the "disruption" tag once the rally is past its opening phase.
export const DISRUPTION_SHOTS = new Set(["SM", "HS", "KL", "NT"]);

// Shots that usually end a rally (auto-suggest the "finish" role).
export const FINISH_SHOTS = new Set(["SM", "KL"]);
