/**
 * La table de jeu : les adversaires en haut, la pioche et la défausse au
 * centre, son propre jeu en bas, et une seule consigne à la fois.
 *
 * Toute interaction se fait en touchant des cartes. Ce composant ne connaît
 * aucune règle : il sait seulement, d'après l'étape annoncée par le serveur,
 * quelles cartes rendre touchables et quelle intention envoyer.
 */
import { useEffect, useMemo, useState } from 'react';
import { act, socket } from '../lib/socket.js';
import { useNow } from '../lib/useGabo.js';
import { definite, indefinite, POWER_TEXT } from '../lib/cards.js';
import { isMuted, setMuted } from '../lib/sound.js';
import Card from './Card.jsx';
import Grid from './Grid.jsx';
import Avatar from './Avatar.jsx';

const REACTIONS = ['😂', '😱', '👏', '🤔', '😤', '😎', '🙈', '🔥'];

export default function Table({ view, receivedAt, highlights, reactions, onRules, onLeave, onLog, onScores }) {
  const round = view.round;
  const me = view.players.find((p) => p.id === view.you);
  const byId = useMemo(() => Object.fromEntries(view.players.map((p) => [p.id, p])), [view.players]);
  const seated = round.seats.includes(view.you);
  const turn = round.turn;
  const myTurn = turn?.playerId === view.you;
  const stage = myTurn ? turn.stage : null;
  const snap = round.snap;
  const canSnap = Boolean(snap?.canSnap && !snap.passed);

  // — État purement local : ce qu'on est en train de choisir. —
  const [mode, setMode] = useState(null); // 'takeDiscard' | 'snap' | null
  const [swapOwn, setSwapOwn] = useState(null);
  const [swapTarget, setSwapTarget] = useState(null);
  const [gaboArmed, setGaboArmed] = useState(false);
  const [showReactions, setShowReactions] = useState(false);

  const stepKey = `${round.number}:${turn?.playerId}:${turn?.stage}:${round.discardCount}`;
  useEffect(() => {
    setSwapOwn(null);
    setSwapTarget(null);
    setGaboArmed(false);
    setMode((m) => (m === 'snap' && snap ? m : null));
  }, [stepKey]);
  useEffect(() => {
    if (!snap) setMode((m) => (m === 'snap' ? null : m));
  }, [snap]);

  // Une horloge locale, pour les comptes à rebours et les cartes qui se retournent.
  const ticking = Boolean(snap) || turn?.remainingMs != null || round.reveals.some((r) => r.remainingMs != null);
  const now = useNow(ticking, snap ? 100 : 250);
  const expiredAt = (remainingMs) => now >= receivedAt + remainingMs;

  // Les adversaires dans l'ordre du jeu, en commençant après soi : c'est
  // l'ordre dans lequel on les verrait autour d'une vraie table.
  const others = useMemo(() => {
    const seats = round.seats;
    const start = seats.indexOf(view.you);
    const ordered = start === -1 ? seats : [...seats.slice(start + 1), ...seats.slice(0, start)];
    return ordered.filter((id) => id !== view.you);
  }, [round.seats, view.you]);
  const spectators = view.players.filter((p) => !round.seats.includes(p.id));

  // — Quelles cartes sont touchables, et ce que le toucher veut dire. —
  const power = stage === 'power' ? turn.power : null;
  const myGrid = round.grids[view.you] ?? [];

  const pickMine = (slot) => {
    if (mode === 'snap') return act({ type: 'SNAP', ownerId: view.you, slot });
    if (stage === 'start' && mode === 'takeDiscard') {
      setMode(null);
      return act({ type: 'TAKE_DISCARD', slot });
    }
    if (stage === 'drawn') return act({ type: 'SWAP_HELD', slot });
    if (power === 'peekOwn') return act({ type: 'USE_POWER', target: { slot } });
    if (power === 'swap') return setSwapOwn((s) => (s === slot ? null : slot));
    return undefined;
  };
  const mineSelectable = () =>
    mode === 'snap' || (stage === 'start' && mode === 'takeDiscard') || stage === 'drawn' || power === 'peekOwn' || power === 'swap';

  const pickTheirs = (ownerId) => (slot) => {
    if (mode === 'snap') return act({ type: 'SNAP', ownerId, slot });
    if (power === 'peekOther') return act({ type: 'USE_POWER', target: { ownerId, slot } });
    if (power === 'swap') {
      return setSwapTarget((t) => (t?.ownerId === ownerId && t.slot === slot ? null : { ownerId, slot }));
    }
    return undefined;
  };
  const theirsSelectable = () => mode === 'snap' || power === 'peekOther' || power === 'swap';

  const confirmSwap = () => {
    if (swapOwn == null || !swapTarget) return;
    act({ type: 'USE_POWER', ownSlot: swapOwn, target: swapTarget });
  };

  const turnPlayer = turn ? byId[turn.playerId] : null;
  const gaboBy = round.gabo ? byId[round.gabo.by] : null;

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col">
      {/* — Barre du haut — */}
      <header className="flex shrink-0 items-center gap-2 px-3 pt-2 pb-1 text-sm">
        <button type="button" onClick={onLeave} className="rounded-md px-2 py-1 text-white/60 hover:bg-white/10" aria-label="Quitter">
          ✕
        </button>
        <span className="font-display text-xl font-bold text-[var(--color-gold)]">Gabo</span>
        <span className="rounded bg-black/25 px-2 py-0.5 font-mono text-xs tracking-widest text-white/80">{view.code}</span>
        <span className="hidden text-white/60 sm:inline">Manche {round.number}</span>
        <span className="flex-1" />
        <IconButton onClick={onScores} label="Scores">🏆</IconButton>
        <IconButton onClick={onLog} label="Journal">📜</IconButton>
        <IconButton onClick={onRules} label="Règles">❔</IconButton>
        <SoundToggle />
      </header>

      {gaboBy && view.phase === 'playing' && (
        <div className="mx-3 mb-1 shrink-0 rounded-lg bg-[var(--color-gold)] px-3 py-1.5 text-center text-sm font-bold text-zinc-900 shadow pop-in">
          {gaboBy.id === view.you ? 'Tu as annoncé GABO' : `${gaboBy.name} a annoncé GABO`} — dernier tour !
        </div>
      )}

      {/* — Adversaires — */}
      {/* Seule zone qui défile : à huit, les adversaires ne tiennent pas tous à
          l'écran d'un téléphone, mais la pioche et son propre jeu doivent
          rester visibles en permanence. */}
      <section className="scrollbar-thin flex min-h-0 flex-1 flex-wrap content-center justify-center gap-2 overflow-y-auto px-2 py-1 sm:gap-3">
        {others.map((id) => (
          <Seat
            key={id}
            player={byId[id]}
            cards={round.grids[id]}
            active={turn?.playerId === id}
            gabo={round.gabo?.by === id}
            ready={view.phase === 'peek' && round.ready.includes(id)}
            peek={view.phase === 'peek'}
            selectable={theirsSelectable()}
            onPick={pickTheirs(id)}
            selectedSlot={swapTarget?.ownerId === id ? swapTarget.slot : null}
            highlights={highlights}
            expiredAt={expiredAt}
            reactions={reactions.filter((r) => r.playerId === id)}
            stage={turn?.playerId === id ? turn.stage : null}
            cardSize={seatCardSize(others.length)}
          />
        ))}
        {!others.length && <p className="py-6 text-white/60">Personne d'autre à cette manche.</p>}
      </section>

      {/* — Centre : pioche, défausse, carte en main — */}
      <section className="flex shrink-0 flex-col items-center justify-center gap-1.5 px-3 py-2">
        <div className="flex items-end justify-center gap-5 sm:gap-10" style={{ fontSize: 'clamp(15px, 2.6vh, 34px)' }}>
          <Pile
            label={`Pioche · ${round.drawCount}`}
            onClick={stage === 'start' && !mode ? () => act({ type: 'DRAW' }) : undefined}
            glow={stage === 'start' && !mode}
            empty={round.drawCount === 0}
          />
          <HeldCard turn={turn} myTurn={myTurn} player={turnPlayer} />
          <DiscardPile
            top={round.discardTop}
            under={round.discardUnder}
            count={round.discardCount}
            glow={stage === 'start'}
            armed={mode === 'takeDiscard'}
            onClick={stage === 'start' ? () => setMode((m) => (m === 'takeDiscard' ? null : 'takeDiscard')) : undefined}
            snap={snap}
          />
        </div>
        <Ticker view={view} />
      </section>

      {/* — Fenêtre de défausse rapide — */}
      {snap && (
        <SnapBar
          snap={snap}
          view={view}
          byId={byId}
          now={now}
          receivedAt={receivedAt}
          canSnap={canSnap}
          mode={mode}
          setMode={setMode}
        />
      )}

      {/* — Mon jeu — */}
      <section
        className={`relative mx-2 mb-2 shrink-0 rounded-2xl border px-3 pt-2 pb-3 safe-bottom ${
          myTurn ? 'my-turn-glow border-[var(--color-gold)] bg-black/30' : 'border-white/10 bg-black/20'
        }`}
      >
        <Instruction
          view={view}
          seated={seated}
          stage={stage}
          power={power}
          mode={mode}
          setMode={setMode}
          turnPlayer={turnPlayer}
          swapOwn={swapOwn}
          swapTarget={swapTarget}
          confirmSwap={confirmSwap}
          gaboArmed={gaboArmed}
          setGaboArmed={setGaboArmed}
          byId={byId}
          now={now}
          receivedAt={receivedAt}
        />
        {seated ? (
          <div className="mt-2 flex items-end justify-center gap-4">
            <div style={{ fontSize: 'clamp(17px, 3.2vh, 42px)' }}>
              <Grid
                cards={myGrid}
                ownerId={view.you}
                isSelectable={mineSelectable}
                onPick={pickMine}
                selectedSlot={swapOwn}
                highlights={highlights}
                expiredAt={expiredAt}
                gap="0.25em"
              />
            </div>
          </div>
        ) : (
          <p className="py-3 text-center text-white/70">Tu regardes cette manche ; tu auras tes cartes à la prochaine donne.</p>
        )}
        <div className="pointer-events-none absolute top-0 left-1/2">
          {reactions
            .filter((r) => r.playerId === view.you)
            .map((r) => (
              <span key={r.id} className="float-up absolute text-4xl">{r.emoji}</span>
            ))}
        </div>
        <div className="absolute right-2 bottom-2 flex flex-col items-end gap-1">
          {showReactions && (
            <div className="flex flex-wrap justify-end gap-1 rounded-xl bg-black/60 p-1.5 pop-in">
              {REACTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="h-9 w-9 rounded-lg text-xl hover:bg-white/15"
                  onClick={() => {
                    socket.emit('gabo:react', { emoji: e });
                    setShowReactions(false);
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowReactions((v) => !v)}
            className="h-10 w-10 rounded-full bg-white/10 text-xl hover:bg-white/20"
            aria-label="Réagir"
          >
            😀
          </button>
        </div>
        {me && (
          <div className="absolute top-2 left-3 hidden items-center gap-1.5 text-xs text-white/60 sm:flex">
            <Avatar player={me} size={20} /> {me.name}
          </div>
        )}
      </section>
      {spectators.length > 0 && (
        <p className="pb-2 text-center text-xs text-white/50">
          Regardent la manche : {spectators.map((p) => p.name).join(', ')}
        </p>
      )}
    </div>
  );
}

function IconButton({ children, onClick, label }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="h-9 w-9 rounded-lg text-lg hover:bg-white/10">
      {children}
    </button>
  );
}

function SoundToggle() {
  const [muted, set] = useState(isMuted());
  return (
    <IconButton
      label={muted ? 'Activer le son' : 'Couper le son'}
      onClick={() => {
        setMuted(!muted);
        set(!muted);
      }}
    >
      {muted ? '🔇' : '🔊'}
    </IconButton>
  );
}

const STAGE_TEXT = {
  start: 'réfléchit…',
  drawn: 'regarde sa carte',
  power: 'utilise un pouvoir',
  snap: 'vient de jeter',
};

/**
 * Plus il y a d'adversaires, plus leurs cartes rapetissent : à huit sur un
 * téléphone, tout le monde doit tenir sur deux rangées, sans défilement.
 */
function seatCardSize(count) {
  if (count <= 3) return 'clamp(11px, 2.1vh, 21px)';
  if (count <= 5) return 'clamp(9.5px, 1.6vh, 19px)';
  return 'clamp(8.5px, 1.35vh, 17px)';
}

function Seat({ player, cards, active, gabo, ready, peek, selectable, onPick, selectedSlot, highlights, expiredAt, reactions, stage, cardSize }) {
  if (!player) return null;
  const count = cards.filter(Boolean).length;
  return (
    <div
      className={`relative flex flex-col items-center gap-1 rounded-xl px-1.5 pt-1.5 pb-1.5 transition sm:min-w-[6.5rem] ${
        active ? 'my-turn-glow bg-black/35' : 'bg-black/20'
      }`}
    >
      {/* Le nom ne doit pas élargir le siège : c'est le jeu qui en donne la largeur. */}
      <div className="w-0 min-w-full">
        <div className="flex items-center justify-center gap-1">
          <Avatar player={player} size={18} ring={active} />
          <span className="truncate text-[11px] font-semibold">{player.name}</span>
        </div>
        {gabo && <div className="mt-0.5 rounded bg-[var(--color-gold)] text-center text-[9px] font-bold text-zinc-900">GABO</div>}
      </div>
      <div style={{ fontSize: cardSize }}>
        <Grid
          cards={cards}
          ownerId={player.id}
          isSelectable={selectable ? () => true : undefined}
          onPick={onPick}
          selectedSlot={selectedSlot}
          highlights={highlights}
          expiredAt={expiredAt}
        />
      </div>
      <div className="w-0 min-w-full truncate text-center text-[10px] leading-tight text-white/60">
        {peek ? (ready ? '✓ prête' : '👀') : active && stage ? STAGE_TEXT[stage] : `${count} carte${count > 1 ? 's' : ''}`}
      </div>
      <div className="pointer-events-none absolute top-2 left-1/2">
        {reactions.map((r) => (
          <span key={r.id} className="float-up absolute text-3xl">{r.emoji}</span>
        ))}
      </div>
    </div>
  );
}

function Pile({ label, onClick, glow, empty }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <div className="flex flex-col items-center gap-1">
      <Tag
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className={`relative rounded-[0.5em] ${glow ? 'my-turn-glow' : ''}`}
        aria-label="Piocher"
      >
        {empty ? (
          <Card card={null} />
        ) : (
          <>
            <span className="absolute top-[0.12em] left-[0.12em]"><Card card={{ down: true }} /></span>
            <span className="absolute top-[0.06em] left-[0.06em]"><Card card={{ down: true }} /></span>
            <Card card={{ down: true }} />
          </>
        )}
      </Tag>
      <span className="text-[11px] text-white/70">{label}</span>
    </div>
  );
}

function DiscardPile({ top, under, count, glow, armed, onClick, snap }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <div className="flex flex-col items-center gap-1">
      <Tag
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className={`relative rounded-[0.5em] ${armed ? 'selected' : glow ? 'my-turn-glow' : ''} ${snap ? 'pulse-ring' : ''}`}
        aria-label="Prendre la défausse"
      >
        {under && (
          <span className="absolute top-0 left-0 rotate-[-8deg] opacity-80">
            <Card card={under} />
          </span>
        )}
        {top ? <Card key={`${top.rank}${top.suit}${count}`} card={top} className="pop-in" /> : <Card card={null} />}
      </Tag>
      <span className="text-[11px] text-white/70">Défausse · {count}</span>
    </div>
  );
}

function HeldCard({ turn, myTurn, player }) {
  if (!turn?.held) return <div style={{ width: '2.5em' }} aria-hidden />;
  return (
    <div className="flex flex-col items-center gap-1 pop-in">
      <div className={myTurn ? '-translate-y-2 scale-110 sm:scale-125' : ''}>
        <Card card={turn.held} />
      </div>
      <span className="max-w-[6rem] truncate text-[11px] text-[var(--color-gold)]">{myTurn ? 'Ta carte' : `Main de ${player?.name ?? '?'}`}</span>
    </div>
  );
}

function Ticker({ view }) {
  const last = view.log.at(-1);
  if (!last) return null;
  return (
    <p key={last.id} className="pop-in line-clamp-1 max-w-xl sm:line-clamp-2 px-2 text-center text-xs text-white/75 sm:text-sm">
      {last.text}
    </p>
  );
}

function SnapBar({ snap, view, byId, now, receivedAt, canSnap, mode, setMode }) {
  const remaining = Math.max(0, snap.remainingMs - (now - receivedAt));
  const ratio = snap.totalMs ? remaining / snap.totalMs : 0;
  const discarder = byId[snap.discarderId];
  const claimer = snap.claimedBy ? byId[snap.claimedBy] : null;
  const mine = snap.discarderId === view.you;
  return (
    <div className="mx-2 mb-2 shrink-0 overflow-hidden rounded-xl border border-[var(--color-gold)]/60 bg-black/45 shadow-lg pop-in">
      <div className="h-1.5 bg-white/10">
        <div className="h-full bg-[var(--color-gold)] transition-[width] duration-100" style={{ width: `${ratio * 100}%` }} />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 px-3 py-2">
        <span className="text-sm">
          {claimer
            ? `${claimer.id === view.you ? 'Tu as' : `${claimer.name} a`} posé ${snap.count} carte${snap.count > 1 ? 's' : ''} !`
            : mine
              ? `Les autres peuvent poser ${indefinite(snap.card.rank)}…`
              : `${discarder?.name ?? '?'} a jeté ${indefinite(snap.card.rank)} — tu en as ${snap.card.rank === 'Q' ? 'une' : 'un'} ?`}
        </span>
        {canSnap && (
          <>
            <button
              type="button"
              onClick={() => setMode((m) => (m === 'snap' ? null : 'snap'))}
              className={`rounded-lg px-4 py-2 font-bold shadow ${
                mode === 'snap' ? 'bg-white text-zinc-900' : 'bg-[var(--color-gold)] text-zinc-900'
              }`}
            >
              {mode === 'snap' ? 'Touche la carte à poser' : `✋ Poser ${indefinite(snap.card.rank)}`}
            </button>
            <button type="button" onClick={() => act({ type: 'PASS_SNAP' })} className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20">
              {claimer ? "C'est tout" : 'Rien à poser'}
            </button>
          </>
        )}
        <span className="font-mono text-sm text-white/70">{(remaining / 1000).toFixed(1)} s</span>
      </div>
    </div>
  );
}

/** Le temps qui reste, quand la table a fixé une limite par tour. */
function TurnClock({ turn, now, receivedAt }) {
  if (turn?.remainingMs == null) return null;
  const left = Math.max(0, Math.ceil((turn.remainingMs - (now - receivedAt)) / 1000));
  return (
    <span className={`rounded-full px-2 py-0.5 font-mono text-xs ${left <= 10 ? 'bg-red-500/80 text-white' : 'bg-black/30 text-white/70'}`}>
      ⏱ {left} s
    </span>
  );
}

function Instruction({ view, seated, stage, power, mode, setMode, turnPlayer, swapOwn, swapTarget, confirmSwap, gaboArmed, setGaboArmed, byId, now, receivedAt }) {
  const round = view.round;
  const isHost = view.you === view.hostId;
  const btn = 'rounded-lg px-4 py-2 font-semibold shadow';

  if (view.phase === 'peek') {
    const ready = round.ready.includes(view.you);
    const waiting = round.seats.filter((id) => !round.ready.includes(id) && byId[id] && !byId[id].bot && byId[id].connected);
    return (
      <div className="flex flex-col items-center gap-2 text-center sm:pt-3">
        {seated && !ready ? (
          <>
            <p className="font-semibold">Mémorise tes 2 cartes du bas : elles vont se retourner.</p>
            <button type="button" className={`${btn} bg-[var(--color-gold)] text-zinc-900`} onClick={() => act({ type: 'READY' })}>
              C'est bon, j'ai mémorisé
            </button>
          </>
        ) : (
          <p className="text-white/80">
            En attente de {waiting.map((id) => byId[id]?.name).join(', ') || 'tout le monde'}…
          </p>
        )}
        {isHost && ready && waiting.length > 0 && (
          <button type="button" className="text-xs text-white/60 underline" onClick={() => act({ type: 'FORCE_START' })}>
            Commencer sans attendre
          </button>
        )}
      </div>
    );
  }

  if (!seated) return null;
  const top = round.discardTop;

  if (stage === 'start') {
    if (mode === 'takeDiscard') {
      return (
        <Bar>
          <span>Touche la carte de ton jeu à remplacer par {top ? definite(top) : 'la défausse'}.</span>
          <button type="button" className={`${btn} bg-white/10`} onClick={() => setMode(null)}>Annuler</button>
        </Bar>
      );
    }
    return (
      <Bar>
        <span className="font-semibold text-[var(--color-gold)]">À toi !</span>
        <span className="text-white/80">Pioche, ou touche la défausse pour la prendre.</span>
        <TurnClock turn={round.turn} now={now} receivedAt={receivedAt} />
        {!round.gabo && (
          <button
            type="button"
            className={`${btn} ${gaboArmed ? 'bg-red-500 text-white' : 'bg-white/15 text-[var(--color-gold)]'}`}
            onClick={() => (gaboArmed ? act({ type: 'CALL_GABO' }) : setGaboArmed(true))}
          >
            {gaboArmed ? 'Confirmer : GABO !' : `Annoncer Gabo (≤ ${view.settings.threshold})`}
          </button>
        )}
      </Bar>
    );
  }
  if (stage === 'drawn') {
    const held = round.turn.held;
    const powerText = { 7: 'peekOwn', 8: 'peekOwn', 9: 'peekOther', 10: 'peekOther', J: 'swap', Q: 'swap' }[held?.rank];
    return (
      <Bar>
        <span>Touche une de tes cartes pour l'échanger, ou</span>
        <button type="button" className={`${btn} bg-[var(--color-gold)] text-zinc-900`} onClick={() => act({ type: 'DISCARD_HELD' })}>
          Jeter {definite(held)}
          {powerText && <span className="block text-[11px] font-normal">et {POWER_TEXT[powerText].toLowerCase()}</span>}
        </button>
      </Bar>
    );
  }
  if (stage === 'power') {
    return (
      <Bar>
        <span className="font-semibold text-[var(--color-gold)]">Pouvoir :</span>
        <span>
          {power === 'peekOwn' && 'touche une de tes cartes pour la regarder.'}
          {power === 'peekOther' && "touche une carte d'une adversaire pour la regarder."}
          {power === 'swap' && (swapOwn == null ? 'choisis la carte que tu donnes' : '✓ ta carte') }
          {power === 'swap' && ' · '}
          {power === 'swap' && (swapTarget ? `✓ carte de ${byId[swapTarget.ownerId]?.name}` : 'et celle que tu prends.')}
        </span>
        {power === 'swap' && swapOwn != null && swapTarget && (
          <button type="button" className={`${btn} bg-[var(--color-gold)] text-zinc-900`} onClick={confirmSwap}>
            Échanger
          </button>
        )}
        <button type="button" className={`${btn} bg-white/10`} onClick={() => act({ type: 'SKIP_POWER' })}>
          Ne pas l'utiliser
        </button>
      </Bar>
    );
  }
  if (stage === 'snap') return <Bar><span className="text-white/80">Tour terminé — les autres peuvent poser.</span></Bar>;
  if (turnPlayer) {
    return (
      <Bar>
        <span className="text-white/75">
          Au tour de <strong className="text-white">{turnPlayer.name}</strong>
          {turnPlayer.bot ? ' 🤖' : ''}
          {!turnPlayer.connected && !turnPlayer.bot ? ' (absente — elle jouera automatiquement)' : ''}
        </span>
        <TurnClock turn={round.turn} now={now} receivedAt={receivedAt} />
        {!turnPlayer.bot && turnPlayer.connected && (
          <button
            type="button"
            className="rounded-full bg-white/10 px-3 py-1 text-xs hover:bg-white/20"
            onClick={() => socket.emit('gabo:nudge', { playerId: turnPlayer.id })}
          >
            ⏰ Presser
          </button>
        )}
      </Bar>
    );
  }
  return null;
}

function Bar({ children }) {
  return <div className="flex min-h-[2.5rem] flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm sm:pt-2">{children}</div>;
}
