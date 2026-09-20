export interface ChangelogEntry {
  date: string;
  items: {
    type: "new" | "fix" | "improved";
    text: string;
  }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-03-27",
    items: [
      { type: "new", text: "Accessibility color vision filters (grayscale, protanopia, deuteranopia, tritanopia)" },
    ],
  },
];
