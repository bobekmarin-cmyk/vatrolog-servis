import path from "path";
import { Font } from "@react-pdf/renderer";

let registered = false;

/**
 * Registers a Unicode TrueType font (Roboto) for @react-pdf so that
 * Croatian diacritics (č, ć, š, đ, ž, Č, Ć, Š, Đ, Ž) render correctly.
 *
 * The built-in PDF core fonts (Helvetica/Times/Courier) only cover
 * Latin-1 and are missing Latin Extended-A glyphs. We ship Roboto TTF
 * files via @expo-google-fonts/roboto (resolved from node_modules at
 * runtime on the Node.js server).
 */
export function registerPdfFonts(): void {
  if (registered) return;
  registered = true;

  const base = path.join(
    process.cwd(),
    "node_modules",
    "@expo-google-fonts",
    "roboto",
  );

  Font.register({
    family: "Roboto",
    fonts: [
      {
        src: path.join(base, "400Regular", "Roboto_400Regular.ttf"),
        fontWeight: 400,
      },
      {
        src: path.join(base, "700Bold", "Roboto_700Bold.ttf"),
        fontWeight: 700,
      },
    ],
  });

  Font.registerHyphenationCallback((word) => [word]);
}
