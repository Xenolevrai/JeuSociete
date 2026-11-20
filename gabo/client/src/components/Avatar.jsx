import { seatColor } from '../lib/cards.js';

/**
 * La marque d'un siège : une pastille carrée de sa couleur, comme un jeton.
 * Pleine pour une personne, creuse pour un bot — on sait toujours à qui l'on joue.
 */
export default function SeatDot({ player, size = 9 }) {
  if (!player) return null;
  return (
    <span
      className="inline-block shrink-0 rounded-[2px]"
      style={{
        width: size,
        height: size,
        background: player.bot ? 'transparent' : seatColor(player),
        border: player.bot ? `2px solid ${seatColor(player)}` : undefined,
        opacity: player.connected || player.bot ? 1 : 0.4,
      }}
      title={player.bot ? 'bot' : undefined}
      aria-hidden
    />
  );
}
