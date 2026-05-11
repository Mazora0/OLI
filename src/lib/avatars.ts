export type AvatarId = 'neo' | 'pixel' | 'astro' | 'ninja' | 'coder' | 'fox';

export const avatarOptions: { id: AvatarId; emoji: string; label: string; gradient: string }[] = [
  { id: 'neo', emoji: '🧑‍💻', label: 'Neo Coder', gradient: 'from-sky-400 to-fuchsia-500' },
  { id: 'pixel', emoji: '👾', label: 'Pixel Bot', gradient: 'from-violet-400 to-pink-500' },
  { id: 'astro', emoji: '🧑‍🚀', label: 'Astro Q', gradient: 'from-blue-400 to-orange-400' },
  { id: 'ninja', emoji: '🥷', label: 'Ninja Dev', gradient: 'from-slate-400 to-cyan-400' },
  { id: 'coder', emoji: '🤖', label: 'QLO Bot', gradient: 'from-emerald-400 to-blue-500' },
  { id: 'fox', emoji: '🦊', label: 'Smart Fox', gradient: 'from-orange-400 to-rose-500' }
];

export function getAvatar(id?: string | null) {
  return avatarOptions.find((item) => item.id === id) || avatarOptions[0];
}
