import { readFileSync } from "node:fs";
import { visionText, visionToken } from "./google-vision";
import { parseOcr } from "./ocr-rules";
import { score } from "./score";

async function main() {
  const sa = JSON.parse(readFileSync(process.env.GOOGLE_VISION_CREDENTIALS_FILE!, "utf8"));
  const tok = await visionToken(sa);
  const img = readFileSync("public/exemplos/burger.jpg");
  const text = await visionText(tok, img);
  console.log(text.slice(0, 300).replace(/\n/g, " | "));
  const gab = JSON.parse(readFileSync("eval/cardapios/burger.gabarito.json", "utf8")).itens;
  console.log(score(gab, parseOcr(text)));
}
main().catch((e) => console.error("erro:", (e as Error).message));
