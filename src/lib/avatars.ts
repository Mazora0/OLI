export type AvatarId = 'aurora' | 'kairo' | 'mika' | 'nova' | 'pixel' | 'raven' | 'sora' | 'zuno';

export type AvatarOption = {
  id: AvatarId;
  label: string;
  gradient: string;
  hair: string;
  skin: string;
  outfit: string;
  accent: string;
  bg: string;
  mark: string;
  emoji: string;
};

export const avatarOptions: AvatarOption[] = [
  { id: 'aurora', label: 'Aurora', gradient: 'from-orange-500 to-rose-600', hair: '#24111a', skin: '#f2b78c', outfit: '#2d1636', accent: '#fb7185', bg: '#2a1026', mark: 'A', emoji: 'A' },
  { id: 'kairo', label: 'Kairo', gradient: 'from-sky-500 to-violet-700', hair: '#101827', skin: '#d79a72', outfit: '#111827', accent: '#38bdf8', bg: '#07111f', mark: 'K', emoji: 'K' },
  { id: 'mika', label: 'Mika', gradient: 'from-fuchsia-500 to-indigo-700', hair: '#3b123f', skin: '#efc2a8', outfit: '#1f1b45', accent: '#f0abfc', bg: '#180926', mark: 'M', emoji: 'M' },
  { id: 'nova', label: 'Nova', gradient: 'from-emerald-500 to-cyan-700', hair: '#13221f', skin: '#bd7b56', outfit: '#073b36', accent: '#34d399', bg: '#03251e', mark: 'N', emoji: 'N' },
  { id: 'pixel', label: 'Pixel', gradient: 'from-violet-500 to-pink-600', hair: '#22113b', skin: '#f0aa83', outfit: '#2b174b', accent: '#a78bfa', bg: '#12071f', mark: 'P', emoji: 'P' },
  { id: 'raven', label: 'Raven', gradient: 'from-slate-700 to-cyan-600', hair: '#06070c', skin: '#c78968', outfit: '#0f172a', accent: '#67e8f9', bg: '#030712', mark: 'R', emoji: 'R' },
  { id: 'sora', label: 'Sora', gradient: 'from-blue-500 to-orange-500', hair: '#27304a', skin: '#f4c19a', outfit: '#172554', accent: '#60a5fa', bg: '#0b1220', mark: 'S', emoji: 'S' },
  { id: 'zuno', label: 'Zuno', gradient: 'from-lime-500 to-teal-700', hair: '#18270f', skin: '#e0a073', outfit: '#164e45', accent: '#bef264', bg: '#10210d', mark: 'Z', emoji: 'Z' }
];

export function getAvatar(id?: string | null) {
  return avatarOptions.find((item) => item.id === id) || avatarOptions[0];
}
