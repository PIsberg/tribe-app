function djb2(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function generateAvatarSvg(seed: string): string {
  const h = djb2(seed);
  const hue1 = h % 360;
  const hue2 = (h >> 4) % 360;
  const hue3 = (h >> 8) % 360;

  const sides = 5 + (h % 4);
  const pts = Array.from({ length: sides }, (_, i) => {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
    const r = 28 + ((h >> (i * 3)) % 16);
    return `${50 + r * Math.cos(angle)},${50 + r * Math.sin(angle)}`;
  }).join(" ");

  const c1 = `hsl(${hue1},80%,60%)`;
  const c2 = `hsl(${hue2},70%,40%)`;
  const c3 = `hsl(${hue3},90%,25%)`;
  const cr = 8 + (h % 10);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs><radialGradient id="g"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c3}"/></radialGradient></defs>
<rect width="100" height="100" fill="${c3}" rx="8"/>
<polygon points="${pts}" fill="url(#g)" opacity="0.9"/>
<circle cx="50" cy="50" r="${cr}" fill="${c2}" opacity="0.85"/>
<circle cx="50" cy="50" r="${Math.round(cr * 0.5)}" fill="${c1}" opacity="0.6"/>
</svg>`;

  return svg;
}

export function avatarDataUrl(seed: string): string {
  return `data:image/svg+xml;base64,${btoa(generateAvatarSvg(seed))}`;
}
