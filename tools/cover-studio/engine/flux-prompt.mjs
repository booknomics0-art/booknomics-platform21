// Prompt recipe for the keyless engine (FLUX.1-schnell run locally with stable-diffusion.cpp).
// FLUX reads about 256 T5 tokens, so the scene comes first and the house style is kept short.

/** @param {{concept:string, palette?:string, mode?:string, theme?:string, style?:string}} b */
export function fluxPrompt(b) {
  const mode = b.mode || String(b.theme || "").split(" · ")[1] || "dark";
  const dark = mode !== "light";
  const pulp = b.style === "pulp";
  return [
    "Photorealistic cinematic film still, vertical book-cover photograph.",
    String(b.concept || "").trim(),
    b.palette ? `Colour palette: ${b.palette}.` : "",
    pulp
      ? dark
        ? "Gritty Indian crime-film look, low-key noir lighting; danger implied, never gory."
        : "Gritty Indian crime-film look in hard, hazy daylight; danger implied, never gory."
      : "",
    "Shot on 35mm film with a 50mm lens, natural light, true-to-life colours, real skin texture, unretouched faces, natural hands, real fabric, dust and wear, shallow depth of field, fine film grain.",
    dark
      ? "The people are in the lower two-thirds; the upper third is calm dark sky or deep shadow with nothing in it."
      : "The people are in the lower two-thirds; the upper third is soft bright sky or a plain light wall with nothing in it.",
    "No text, letters, numbers, signboards or logos anywhere.",
  ].filter(Boolean).join(" ");
}
