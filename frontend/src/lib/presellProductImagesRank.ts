/**
 * Prioriza fotos de pack / produto em relação a logos, ícones e retratos de testemunhos,
 * para a hero e a galeria mostrarem primeiro a imagem certa (sem reimportar a presell).
 */

export function scorePresellProductImageUrl(url: string): number {
  let score = 0;
  let u = url;
  try {
    u = decodeURIComponent(url);
  } catch {
    u = url;
  }
  u = u.toLowerCase();

  const boost = (re: RegExp, pts: number) => {
    if (re.test(u)) score += pts;
  };
  const penal = (re: RegExp, pts: number) => {
    if (re.test(u)) score -= pts;
  };

  boost(/\b(bottle|flacon|jar|supplement|packshot|package|prod(uct)?[_-]?image|hero|featured|main[_-]?image|primary|sku|label|render|mockup|bundle|offer|vitamin|capsule)\b/i, 28);
  boost(/\b(nitric|probiotic|collagen|keto|ketogenic|ashwagandha|metabolic|gummies)\b/i, 18);
  boost(/\/products?\//, 12);
  boost(/\b(large|xlarge|full|retina|hi[_-]?res|original)\b/, 10);
  boost(/(?:[?&/_-])(?:w|width)=?(?:640|720|800|960|1024|1200|1280|1600|1920|2048)(?:[^0-9]|$)/, 14);
  boost(/(?:\b|_)(1024|1200|1600|2048)x\d{3,4}\b/, 16);
  boost(/shopify\.com\/s\/files\/1\//, 6);

  const dimPair = u.match(/\b(\d{2,4})x(\d{2,4})\b/);
  if (dimPair) {
    const w = Number(dimPair[1]);
    const h = Number(dimPair[2]);
    if (w > 0 && h > 0 && w <= 180 && h <= 180) score -= 42;
    if (w >= 400 || h >= 400) score += 10;
  }

  penal(/\b(avatar|testimonial|testimonials|reviewer|gravatar|userpic|headshot|customer[_-]?story|before[_-]?and[_-]?after)\b/i, 55);
  penal(/\/(testimonial|testimonials|reviews?|avatar|avatars|team|people|faces|customers)\//i, 45);
  penal(/\b(quote|verified[_-]?buyer|five[_-]?star|rating[_-]?star)\b/i, 25);
  penal(/\b(logo|logos|brandmark|favicon|sprite|payment[_-]?icon|trust[_-]?badge|badge[_-]?icon)\b/i, 50);
  penal(/\b(icon|ico|glyph|spacer|pixel\.gif|1x1)\b/i, 35);
  penal(/(32x32|40x40|48x48|56x56|64x64|96x96|100x100|128x128)/, 40);
  penal(/(?:[?&/_-])(?:w|width|h|height)=?(?:16|20|24|32|40|48|56|64|80|96|100|120)(?:[^0-9]|$)/, 30);
  penal(/([_-](xs|sm|thumb|thumbnail)\b|\/thumbs?\/)/i, 22);
  penal(/chart\.googleapis\.com|googleusercontent\.com\/.*(photo|a-)/i, 40);

  return score;
}

export function rankPresellProductImages(urls: string[]): string[] {
  if (urls.length <= 1) return urls;
  const entries = urls.map((url, index) => ({
    url,
    index,
    score: scorePresellProductImageUrl(url),
  }));
  entries.sort((a, b) => b.score - a.score || a.index - b.index);
  return entries.map((e) => e.url);
}
