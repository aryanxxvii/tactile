const sans = (family) => `"${family}", "Segoe UI Variable", Arial, sans-serif`;
const serif = (family) => `"${family}", Georgia, serif`;

const families = {
  instrument: sans("Instrument Sans Variable"),
  inter: sans("Inter Variable"),
  geist: sans("Geist Variable"),
  manrope: sans("Manrope Variable"),
  figtree: sans("Figtree Variable"),
  dmSans: sans("DM Sans Variable"),
  ibmPlexSans: sans("IBM Plex Sans Variable"),
  publicSans: sans("Public Sans Variable"),
  sourceSans: sans("Source Sans 3 Variable"),
  libreFranklin: sans("Libre Franklin Variable"),
  spaceGrotesk: sans("Space Grotesk Variable"),
  jakarta: sans("Plus Jakarta Sans Variable"),
  newsreader: serif("Newsreader Variable"),
  sourceSerif: serif("Source Serif 4 Variable"),
  literata: serif("Literata Variable"),
  fraunces: serif("Fraunces Variable"),
  ibmPlexSerif: serif("IBM Plex Serif"),
};

const idea = (
  id,
  name,
  category,
  display,
  ui,
  description = ui,
  body = description,
  titleWeight = 620,
  titleTracking = "-0.035em",
) => ({
  id,
  number: String(id).padStart(2, "0"),
  name,
  category,
  display,
  ui,
  description,
  body,
  titleWeight,
  titleTracking,
});

export const TYPE_IDEAS = [
  idea(1, "Instrument Plain", "quiet sans", families.instrument, families.instrument),
  idea(2, "Geist Utility", "quiet sans", families.geist, families.geist, families.geist, families.geist, 590),
  idea(3, "Inter Familiar", "quiet sans", families.inter, families.inter, families.inter, families.inter, 610),
  idea(4, "Figtree Friendly", "quiet sans", families.figtree, families.figtree, families.figtree, families.figtree, 620),
  idea(5, "DM Soft", "quiet sans", families.dmSans, families.dmSans, families.dmSans, families.dmSans, 610),
  idea(6, "Manrope Open", "quiet sans", families.manrope, families.manrope, families.manrope, families.manrope, 620),
  idea(7, "Plex Rational", "quiet sans", families.ibmPlexSans, families.ibmPlexSans, families.ibmPlexSans, families.ibmPlexSans, 600, "-0.025em"),
  idea(8, "Public Service", "quiet sans", families.publicSans, families.publicSans, families.publicSans, families.publicSans, 620),
  idea(9, "Source Clear", "quiet sans", families.sourceSans, families.sourceSans, families.sourceSans, families.sourceSans, 620, "-0.025em"),
  idea(10, "Franklin Editorial", "quiet sans", families.libreFranklin, families.libreFranklin, families.libreFranklin, families.libreFranklin, 620),
  idea(11, "Space Precise", "quiet sans", families.spaceGrotesk, families.spaceGrotesk, families.spaceGrotesk, families.spaceGrotesk, 590),
  idea(12, "Jakarta Rounded", "quiet sans", families.jakarta, families.jakarta, families.jakarta, families.jakarta, 620),

  idea(13, "Instrument Reader", "sans + serif", families.instrument, families.instrument, families.newsreader, families.newsreader),
  idea(14, "Instrument Source", "sans + serif", families.instrument, families.instrument, families.sourceSerif, families.sourceSerif),
  idea(15, "Instrument Literata", "sans + serif", families.instrument, families.instrument, families.literata, families.literata),
  idea(16, "Geist Reader", "sans + serif", families.geist, families.geist, families.newsreader, families.newsreader, 590),
  idea(17, "Inter Reader", "sans + serif", families.inter, families.inter, families.newsreader, families.newsreader, 610),
  idea(18, "Inter Source", "sans + serif", families.inter, families.inter, families.sourceSerif, families.sourceSerif, 610),
  idea(19, "Plex Duo", "sans + serif", families.ibmPlexSans, families.ibmPlexSans, families.ibmPlexSerif, families.ibmPlexSerif, 600, "-0.025em"),
  idea(20, "Source Duo", "sans + serif", families.sourceSans, families.sourceSans, families.sourceSerif, families.sourceSerif, 620, "-0.025em"),
  idea(21, "DM Reader", "sans + serif", families.dmSans, families.dmSans, families.newsreader, families.newsreader, 610),
  idea(22, "Manrope Literata", "sans + serif", families.manrope, families.manrope, families.literata, families.literata, 620),
  idea(23, "Figtree Reader", "sans + serif", families.figtree, families.figtree, families.newsreader, families.newsreader, 620),
  idea(24, "Public Source", "sans + serif", families.publicSans, families.publicSans, families.sourceSerif, families.sourceSerif, 620),
  idea(25, "Franklin Reader", "sans + serif", families.libreFranklin, families.libreFranklin, families.newsreader, families.newsreader, 620),
  idea(26, "Space Literata", "sans + serif", families.spaceGrotesk, families.spaceGrotesk, families.literata, families.literata, 590),
  idea(27, "Jakarta Reader", "sans + serif", families.jakarta, families.jakarta, families.newsreader, families.newsreader, 620),

  idea(28, "Instrument over Geist", "crossed sans", families.instrument, families.geist, families.geist, families.geist, 630),
  idea(29, "Newsreader Compact", "editorial title", families.newsreader, families.instrument, families.instrument, families.newsreader, 590, "-0.025em"),
  idea(30, "Fraunces Ledger", "editorial title", families.fraunces, families.ibmPlexSans, families.ibmPlexSans, families.sourceSerif, 570, "-0.025em"),
];

export const DEFAULT_TYPE_IDEA_ID = 8;

export function typeIdeaFor(id) {
  return TYPE_IDEAS.find((candidate) => candidate.id === Number(id)) || TYPE_IDEAS[0];
}

export function typeIdeaStyle(typeIdea) {
  return {
    "--font-display": typeIdea.display,
    "--font-ui": typeIdea.ui,
    "--font-description": typeIdea.description,
    "--font-body": typeIdea.body,
    "--font-mono": '"Lilex Variable", "Cascadia Mono", Consolas, monospace',
    "--title-weight": typeIdea.titleWeight,
    "--title-tracking": typeIdea.titleTracking,
  };
}
