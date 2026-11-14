// The System reveals itself as you level. Original text, written for this app.

export interface LoreEntry {
  level: number;
  title: string;
  text: string;
}

export const LORE: LoreEntry[] = [
  { level: 1, title: 'Awakening', text: 'A window opened that no one else could see. It asked one question: will you grow stronger? You said yes before you understood what that meant.' },
  { level: 2, title: 'The First Rule', text: 'The System does not reward talent. It rewards the person who shows up when no one is watching, and proves it.' },
  { level: 3, title: 'Muscle Memory', text: 'Every repetition leaves a mark the System can read. Strain fades, but the record of effort does not.' },
  { level: 4, title: 'Gates', text: 'Gates open once a week, deeper than the daily path. Those who enter come back changed. Those who ignore them find the gate does not stay quiet.' },
  { level: 5, title: 'Other Hunters', text: 'You are not the only one with a window. Somewhere, others answered the same question. The System lets you see them now.' },
  { level: 7, title: 'Penalties', text: 'The System is patient but not forgiving. A missed day is recorded. A survived penalty is recorded too, and weighs more.' },
  { level: 10, title: 'The First Trial', text: 'Rank is not given. It is tested. The System has prepared a gate measured to the rank above yours.' },
  { level: 15, title: 'Shadows', text: 'Your greatest efforts do not vanish. They linger as shadows at your back, a quiet army built from every perfect week.' },
  { level: 20, title: 'Recovery', text: 'The strongest hunters learned to rest on purpose. The System counts restraint as intelligence.' },
  { level: 27, title: 'The Long Climb', text: 'The early levels came quickly. Now each one is earned in weeks, not days. The System calls this the real beginning.' },
  { level: 35, title: 'Discipline', text: 'Motivation was the spark. Discipline is the fire that stays lit when the spark is gone. Your streak is proof of which one you have.' },
  { level: 40, title: 'Job Change', text: 'The System offers a choice that cannot be undone: what kind of hunter will you become? Prove yourself across three days to choose.' },
  { level: 50, title: 'Elite', text: 'Few reach this far. Fewer stay. The System notes that you are still here.' },
  { level: 70, title: 'National Level', text: 'Others measure themselves against you now. The System reminds you that the only rival that matters is yesterday.' },
  { level: 85, title: 'Monarch', text: 'Your shadows outnumber your doubts. The System has nothing left to test except whether you will keep going.' },
  { level: 100, title: 'Beyond the Window', text: 'The window shows the same question it asked on day one. You know the answer now, and it was never about the System.' },
];

export const loreUnlocked = (level: number) => LORE.filter((l) => level >= l.level);
