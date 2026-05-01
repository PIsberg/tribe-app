const ADJECTIVES = [
  "Electric", "Neon", "Shadow", "Crystal", "Iron", "Wild",
  "Solar", "Lunar", "Cosmic", "Ancient", "Digital", "Sacred",
  "Thunder", "Mystic", "Phantom", "Savage", "Primal", "Silent",
  "Obsidian", "Crimson", "Azure", "Golden", "Void", "Storm",
  "Hollow", "Feral", "Blazing", "Frozen", "Spectral", "Rogue",
];

const NOUNS = [
  "Wolf", "Hawk", "Bison", "Raven", "Bear", "Fox", "Eagle", "Lynx",
  "Tiger", "Cobra", "Falcon", "Jaguar", "Panther", "Viper", "Phoenix",
  "Dragon", "Sphinx", "Ghost", "Nomad", "Cipher", "Wraith", "Specter",
  "Coyote", "Stallion", "Serpent", "Condor", "Marlin", "Jackal",
];

export function generateTribeName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj} ${noun}`;
}

export function generateUserId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
