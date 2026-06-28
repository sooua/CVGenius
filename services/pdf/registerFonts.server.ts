import "server-only";
import path from "node:path";
import { Font } from "@react-pdf/renderer";

// Server PDF rendering uses the full CJK fonts from the filesystem. Registered
// once per process; renderResumePdf calls this before each render.
let registered = false;

export function registerServerFonts() {
  if (registered) return;
  const fontsDir = path.join(process.cwd(), "public/fonts");

  Font.register({
    family: "NotoSansSC",
    fonts: [
      { src: path.join(fontsDir, "NotoSansSC-Regular.otf"), fontWeight: 400 },
      { src: path.join(fontsDir, "NotoSansSC-Medium.otf"), fontWeight: 500 },
    ],
  });
  Font.register({
    family: "NotoSerifSC",
    src: path.join(fontsDir, "NotoSerifSC-Regular.otf"),
  });
  // Disable automatic hyphenation — it mangles CJK word boundaries.
  Font.registerHyphenationCallback((word) => [word]);

  registered = true;
}
