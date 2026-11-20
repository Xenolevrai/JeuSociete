import { seatColor, initials } from '../lib/cards.js';

/** La pastille d'une joueuse : sa couleur de siège et ses initiales. */
export default function Avatar({ player, size = 32, ring = false }) {
  if (!player) return null;
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center rounded-full font-bold text-zinc-900"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: seatColor(player),
        boxShadow: ring ? '0 0 0 2px var(--color-gold), 0 0 12px rgba(217,173,79,0.8)' : '0 1px 3px rgba(0,0,0,0.4)',
        opacity: player.connected || player.bot ? 1 : 0.45,
      }}
      title={player.name}
    >
      {player.bot ? '🤖' : initials(player.name)}
      {!player.connected && !player.bot && (
        <span className="absolute -right-1 -bottom-1 rounded-full bg-zinc-800 px-1 text-[9px] text-white">zz</span>
      )}
    </span>
  );
}
