/**
 * La table de jeu : les adversaires en haut, la pioche et la défausse au
 * centre, son propre jeu en bas, et une seule consigne à la fois.
 *
 * Tout se joue en touchant des cartes. Ce composant ne connaît aucune règle :
 * d'après l'étape annoncée par le serveur, il sait seulement quelles cartes
 * rendre touchables et quelle intention envoyer.
 *
 * La défausse rapide se joue d'un seul geste : pendant que la défausse est
 * ouverte, toucher une carte — la sienne ou celle d'une autre — c'est la
 * poser. À la table, on ne demande pas la permission avant de taper la carte.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { act, socket } from '../lib/socket.js';
import { useNow } from '../lib/useGabo.js';
import { definite, indefinite, POWER_TEXT } from '../lib/cards.js';
import { isMuted, setMuted } from '../lib/sound.js';
import Card from './Card.jsx';
import Grid from './Grid.jsx';
import SeatDot from './SeatDot.jsx';
import { IconScore, IconLog, IconRules, IconSound, IconMute, IconLeave, IconTalk, IconHurry } from './Icons.jsx';

const PHRASES = ['Bien joué', 'Aïe !', 'Bluff…', 'Vite !', 'Hmm…', 'Merci !', 'Oh non', 'Ha ha'];

export default function Table({ view, receivedAt, marks, reactions, onRules, onLeave, onLog, onScores }) {
  const round = view.round;
  const me = view.players.find((p) => p.id === view.you);
  const byId = useMemo(() => Object.fromEntries(view.players.map((p) => [p.id, p])), [view.players]);
  const seated = round.seats.includes(view.you);
  const turn = round.turn;
  const myTurn = turn?.playerId === view.you;
  const stage = myTurn ? turn.stage : null;
  const power = stage === 'power' ? turn.power : null;
  const snap = round.snap;
  const canSnap = Boolean(snap?.canSnap && !snap.passed);

  // — Ce qu'on est en train de choisir, sur cet écran seulement. —
  const [takingDiscard, setTakingDiscard] = useState(false);
  const [swapOwn, setSwapOwn] = useState(null);
  const [swapTarget, setSwapTarget] = useState(null);
  const [gaboArmed, setGaboArmed] = useState(false);
  const [talkOpen, setTalkOpen] = useState(false);
  // Le premier toucher d'un double toucher : quelle carte, et quand.
  const [primed, setPrimed] = useState(null);
  const primedAt = useRef(0);

  const stepKey = `${round.number}:${turn?.playerId}:${turn?.stage}:${round.discardCount}`;
  useEffect(() => {
    setSwapOwn(null);
    setSwapTarget(null);
    setGaboArmed(false);
    setTakingDiscard(false);
  }, [stepKey]);

  const ticking = Boolean(snap) || turn?.remainingMs != null || round.reveals.some((r) => r.remainingMs != null);
  const now = useNow(ticking, snap ? 100 : 250);
  const expired = (remainingMs) => now >= receivedAt + remainingMs;

  // Les adversaires dans l'ordre du jeu, en commençant après soi.
  const others = useMemo(() => {
    const seats = round.seats;
    const start = seats.indexOf(view.you);
    const ordered = start === -1 ? seats : [...seats.slice(start + 1), ...seats.slice(0, start)];
    return ordered.filter((id) => id !== view.you);
  }, [round.seats, view.you]);
  const spectators = view.players.filter((p) => !round.seats.includes(p.id));

  /**
   * Poser une carte se fait d'un DOUBLE toucher : rapide quand on sait, mais
   * jamais par accident — un toucher seul ne fait que la soulever. Le jeu ne
   * suggère rien : toutes les cartes se touchent pareil, à chacune de se
   * souvenir où est son 2.
   */
  const tapToSnap = (ownerId, slot) => {
    const key = `${ownerId}:${slot}`;
    const now = Date.now();
    if (primed === key && now - primedAt.current < 600) {
      setPrimed(null);
      return act({ type: 'SNAP', ownerId, slot });
    }
    primedAt.current = now;
    setPrimed(key);
    setTimeout(() => setPrimed((p) => (p === key ? null : p)), 650);
    return undefined;
  };
  useEffect(() => {
    if (!snap) setPrimed(null);
  }, [snap]);

  // — Toucher une de ses cartes —
  const mineTouchable = canSnap || (stage === 'start' && takingDiscard) || stage === 'drawn' || power === 'peekOwn' || power === 'swap';
  const pickMine = (slot) => {
    if (canSnap) return tapToSnap(view.you, slot);
    if (stage === 'start' && takingDiscard) return act({ type: 'TAKE_DISCARD', slot });
    if (stage === 'drawn') return act({ type: 'SWAP_HELD', slot });
    if (power === 'peekOwn') return act({ type: 'USE_POWER', target: { slot } });
    if (power === 'swap') return setSwapOwn((s) => (s === slot ? null : slot));
    return undefined;
  };
  // — Toucher une carte d'une autre —
  const theirsTouchable = canSnap || power === 'peekOther' || power === 'swap';
  const pickTheirs = (ownerId) => (slot) => {
    if (canSnap) return tapToSnap(ownerId, slot);
    if (power === 'peekOther') return act({ type: 'USE_POWER', target: { ownerId, slot } });
    if (power === 'swap') return setSwapTarget((t) => (t?.ownerId === ownerId && t.slot === slot ? null : { ownerId, slot }));
    return undefined;
  };

  const turnPlayer = turn ? byId[turn.playerId] : null;
  const gaboBy = round.gabo ? byId[round.gabo.by] : null;

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col">
      <header className="flex shrink-0 items-center gap-1 px-2 pt-1.5 sm:px-4">
        <span className="font-display text-xl text-[var(--color-chalk)] italic" style={{ fontVariationSettings: '"SOFT" 100, "opsz" 72' }}>
          Gabo
        </span>
        <span className="ml-2 font-mono text-xs tracking-[0.2em] text-[var(--color-chalk-soft)]">{view.code}</span>
        <span className="ml-3 hidden text-xs text-[var(--color-chalk-soft)] sm:inline">manche {round.number}</span>
        <span className="flex-1" />
        <ToolButton onClick={onScores} label="Feuille de marque"><IconScore /></ToolButton>
        <ToolButton onClick={onLog} label="Journal"><IconLog /></ToolButton>
        <ToolButton onClick={onRules} label="Règles"><IconRules /></ToolButton>
        <SoundToggle />
        <ToolButton onClick={onLeave} label="Quitter la table"><IconLeave /></ToolButton>
      </header>

      {gaboBy && view.phase === 'playing' && (
        <div className="rise mx-auto mt-1 shrink-0 rounded-[3px] bg-[var(--color-paper)] px-3 py-1 text-center text-sm text-[var(--color-ink)] shadow">
          <span className="font-display font-semibold text-[var(--color-red)] italic">Gabo !</span>{' '}
          {gaboBy.id === view.you ? 'Tu as annoncé' : `${gaboBy.name} a annoncé`} — dernier tour.
        </div>
      )}

      {/* La seule zone qui défile : à huit, les adversaires peuvent déborder,
          mais la pioche et son propre jeu restent toujours à l'écran. */}
      <section className="scroll-thin flex min-h-0 flex-1 flex-wrap content-center justify-center gap-x-3 gap-y-2 overflow-y-auto px-2 py-2 sm:gap-x-6">
        {others.map((id) => (
          <Seat
            key={id}
            player={byId[id]}
            cards={round.grids[id]}
            active={turn?.playerId === id}
            stage={turn?.playerId === id ? turn.stage : null}
            gabo={round.gabo?.by === id}
            phase={view.phase}
            ready={round.ready.includes(id)}
            touchable={theirsTouchable}
            onPick={pickTheirs(id)}
            chosenSlot={
              primed?.startsWith(`${id}:`) ? Number(primed.split(':')[1]) : swapTarget?.ownerId === id ? swapTarget.slot : null
            }
            marks={marks}
            expired={expired}
            said={reactions.filter((r) => r.playerId === id)}
            cardSize={seatCardSize(others.length)}
          />
        ))}
        {!others.length && <p className="py-6 text-[var(--color-chalk-soft)]">Personne d'autre à cette manche.</p>}
      </section>

      {/* — Le centre : pioche, carte en main, défausse — */}
      <section className="flex shrink-0 flex-col items-center gap-1.5 px-3 pt-1 pb-2">
        <div className="flex items-end justify-center gap-6 sm:gap-12" style={{ fontSize: 'clamp(15px, min(3.2vh, 4.3vw), 34px)' }}>
          <DrawPile count={round.drawCount} onClick={stage === 'start' && !takingDiscard ? () => act({ type: 'DRAW' }) : undefined} />
          <Held turn={turn} mine={myTurn} player={turnPlayer} />
          <DiscardPile
            top={round.discardTop}
            under={round.discardUnder}
            count={round.discardCount}
            open={Boolean(snap)}
            chosen={takingDiscard}
            onClick={stage === 'start' ? () => setTakingDiscard((v) => !v) : undefined}
          />
        </div>
        <div className="flex min-h-[2.4rem] w-full max-w-xl items-center justify-center">
          {snap ? (
            <SnapLine snap={snap} view={view} byId={byId} now={now} receivedAt={receivedAt} canSnap={canSnap} />
          ) : (
            <Ticker view={view} />
          )}
        </div>
      </section>

      {/* — Mon jeu — */}
      <section className="relative shrink-0 border-t border-[var(--color-felt-line)] bg-[var(--color-felt-dark)]/60 px-3 pt-2 safe-bottom">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-2">
          <Prompt
            view={view}
            seated={seated}
            stage={stage}
            power={power}
            takingDiscard={takingDiscard}
            setTakingDiscard={setTakingDiscard}
            turnPlayer={turnPlayer}
            swapOwn={swapOwn}
            swapTarget={swapTarget}
            gaboArmed={gaboArmed}
            setGaboArmed={setGaboArmed}
            byId={byId}
            now={now}
            receivedAt={receivedAt}
            canSnap={canSnap}
          />
          {seated ? (
            <div className="relative pb-1" style={{ fontSize: 'clamp(17px, min(3.8vh, 5.2vw), 40px)' }}>
              <Grid
                cards={round.grids[view.you] ?? []}
                ownerId={view.you}
                isTouchable={() => mineTouchable}
                onPick={pickMine}
                chosenSlot={primed?.startsWith(`${view.you}:`) ? Number(primed.split(':')[1]) : swapOwn}
                marks={marks}
                expired={expired}
                gap="0.22em"
              />
              {reactions
                .filter((r) => r.playerId === view.you)
                .slice(-1)
                .map((r) => (
                  <Bubble key={r.id} text={r.text} />
                ))}
            </div>
          ) : (
            <p className="py-3 text-center text-sm text-[var(--color-chalk-soft)]">
              Tu regardes cette manche ; tu recevras tes cartes à la prochaine donne.
            </p>
          )}
        </div>
        {me && (
          <div className="absolute top-2 left-3 hidden items-center gap-1.5 text-xs text-[var(--color-chalk-soft)] sm:flex">
            <SeatDot player={me} /> {me.name}
          </div>
        )}
        <div className="absolute right-2 bottom-2 flex flex-col items-end gap-1">
          {talkOpen && (
            <div className="rise grid w-[13.5rem] grid-cols-2 gap-1 rounded-[4px] bg-[var(--color-paper)] p-1.5 shadow-lg">
              {PHRASES.map((text) => (
                <button
                  key={text}
                  type="button"
                  className="min-h-[36px] rounded-[3px] px-2 text-left text-sm text-[var(--color-ink)] hover:bg-[var(--color-paper-2)]"
                  onClick={() => {
                    socket.emit('gabo:react', { text });
                    setTalkOpen(false);
                  }}
                >
                  {text}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setTalkOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-chalk-soft)] hover:text-[var(--color-chalk)]"
            aria-label="Dire un mot à la table"
          >
            <IconTalk />
          </button>
        </div>
      </section>
      {spectators.length > 0 && (
        <p className="bg-[var(--color-felt-dark)]/60 pb-1 text-center text-[11px] text-[var(--color-chalk-soft)]">
          Regardent : {spectators.map((p) => p.name).join(', ')}
        </p>
      )}
    </div>
  );
}

function ToolButton({ children, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 items-center justify-center rounded-[4px] text-[var(--color-chalk-soft)] hover:text-[var(--color-chalk)]"
    >
      {children}
    </button>
  );
}

function SoundToggle() {
  const [muted, set] = useState(isMuted());
  return (
    <ToolButton
      label={muted ? 'Remettre le son' : 'Couper le son'}
      onClick={() => {
        setMuted(!muted);
        set(!muted);
      }}
    >
      {muted ? <IconMute /> : <IconSound />}
    </ToolButton>
  );
}

/** Une bulle de papier : ce qu'une joueuse vient de dire à la table. */
function Bubble({ text }) {
  return (
    <span className="say pointer-events-none absolute -top-2 left-1/2 z-10 rounded-[3px] bg-[var(--color-paper)] px-2 py-0.5 text-xs whitespace-nowrap text-[var(--color-ink)] shadow-md">
      {text}
    </span>
  );
}

/**
 * Plus il y a d'adversaires, plus leurs cartes rapetissent : à huit sur un
 * téléphone, tout le monde doit tenir sur deux rangées.
 */
function seatCardSize(count) {
  // Le plus petit des deux : la hauteur limite sur téléphone, la largeur sur
  // une tablette en paysage ; sur ordinateur, c'est le plafond qui joue.
  if (count <= 3) return 'clamp(11px, min(2.9vh, 3.4vw), 26px)';
  if (count <= 5) return 'clamp(9.5px, min(2.4vh, 2.8vw), 22px)';
  return 'clamp(8px, min(2.1vh, 2.2vw), 20px)';
}

const STAGE_TEXT = { start: 'réfléchit', drawn: 'a pioché', power: 'utilise un pouvoir', snap: 'a jeté' };

function Seat({ player, cards, active, stage, gabo, phase, ready, touchable, onPick, chosenSlot, marks, expired, said, cardSize }) {
  if (!player) return null;
  const count = cards.filter(Boolean).length;
  let meta = `${count} carte${count > 1 ? 's' : ''}`;
  if (phase === 'peek') meta = ready || player.bot ? 'prête' : 'mémorise';
  else if (active && stage) meta = STAGE_TEXT[stage];
  return (
    <div className="relative flex flex-col items-center gap-1">
      {/* L'étiquette de place : papier, passée à l'ocre quand c'est son tour.
          Elle peut déborder un peu des cartes — un prénom coupé à deux
          lettres ne dit plus à qui l'on joue. */}
      <div
        className={`flex max-w-[5.8rem] items-center gap-1 rounded-[2px] px-1.5 py-[1px] text-[11px] font-semibold text-[var(--color-ink)] ${
          active ? 'bg-[var(--color-ochre)]' : 'bg-[var(--color-paper)]'
        }`}
      >
        <SeatDot player={player} size={7} />
        <span className="truncate">{player.name}</span>
      </div>
      <div style={{ fontSize: cardSize }}>
        <Grid
          cards={cards}
          ownerId={player.id}
          isTouchable={touchable ? () => true : undefined}
          onPick={onPick}
          chosenSlot={chosenSlot}
          marks={marks}
          expired={expired}
        />
      </div>
      <div className="w-0 min-w-full truncate text-center text-[10px] leading-tight text-[var(--color-chalk-soft)]">
        {gabo ? <span className="font-display font-semibold text-[var(--color-ochre)] italic">Gabo</span> : meta}
        {!player.connected && !player.bot && ' · absente'}
      </div>
      {said.slice(-1).map((r) => (
        <Bubble key={r.id} text={r.text} />
      ))}
    </div>
  );
}

function DrawPile({ count, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <div className="flex flex-col items-center gap-1">
      <Tag type={onClick ? 'button' : undefined} onClick={onClick} aria-label="Piocher" className="relative block" style={{ width: '2.5em', height: '3.5em' }}>
        {count === 0 ? (
          <Card card={null} />
        ) : (
          <>
            {count > 2 && <Card card={{ down: true }} className="!absolute" style={{ top: '0.1em', left: '0.07em' }} />}
            {count > 1 && <Card card={{ down: true }} className="!absolute" style={{ top: '0.05em', left: '0.035em' }} />}
            <Card card={{ down: true }} touchable={Boolean(onClick)} className="!absolute top-0 left-0" />
          </>
        )}
      </Tag>
      <span className="text-[11px] text-[var(--color-chalk-soft)]">pioche · {count}</span>
    </div>
  );
}

function DiscardPile({ top, under, count, open, chosen, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <div className="flex flex-col items-center gap-1">
      <Tag type={onClick ? 'button' : undefined} onClick={onClick} aria-label="Prendre la défausse" className="relative block" style={{ width: '2.5em', height: '3.5em' }}>
        {under && <Card card={under} className="!absolute top-0 left-0" style={{ transform: 'rotate(-7deg)' }} />}
        {top ? (
          <Card
            key={`${top.rank}${top.suit}${count}`}
            card={top}
            touchable={Boolean(onClick) && !chosen}
            chosen={chosen}
            className="rise !absolute top-0 left-0"
            style={open ? { boxShadow: '0 0 0 2px var(--color-chalk)' } : undefined}
          />
        ) : (
          <Card card={null} />
        )}
      </Tag>
      <span className="text-[11px] text-[var(--color-chalk-soft)]">défausse · {count}</span>
    </div>
  );
}

function Held({ turn, mine, player }) {
  if (!turn?.held) return <div style={{ width: '2.5em' }} aria-hidden />;
  return (
    <div className="rise flex flex-col items-center gap-1">
      <div style={mine ? { transform: 'scale(1.1)', transformOrigin: 'bottom center' } : undefined}>
        <Card card={turn.held} />
      </div>
      <span className="max-w-[6.5rem] truncate text-[11px] text-[var(--color-chalk)]">{mine ? 'ta carte' : `en main · ${player?.name ?? '?'}`}</span>
    </div>
  );
}

function Ticker({ view }) {
  const last = view.log.at(-1);
  if (!last) return null;
  return (
    <p key={last.id} className="rise line-clamp-2 px-2 text-center font-display text-[13px] text-[var(--color-chalk-soft)] italic sm:text-sm">
      {last.text}
    </p>
  );
}

/** La défausse est ouverte : un trait qui se consume, et ce qu'on peut y faire. */
function SnapLine({ snap, view, byId, now, receivedAt, canSnap }) {
  const remaining = Math.max(0, snap.remainingMs - (now - receivedAt));
  const ratio = snap.totalMs ? remaining / snap.totalMs : 0;
  const claimer = snap.claimedBy ? byId[snap.claimedBy] : null;
  const discarder = byId[snap.discarderId];
  const what = indefinite(snap.card.rank);
  let text;
  if (claimer) text = `${claimer.id === view.you ? 'Tu as' : `${claimer.name} a`} posé ${snap.count} carte${snap.count > 1 ? 's' : ''}.`;
  else if (snap.discarderId === view.you) text = `Les autres peuvent poser ${what}.`;
  else if (canSnap) text = `Défausse ouverte sur ${what}. Touche deux fois une carte pour la poser.`;
  else text = `${discarder?.name ?? '?'} a jeté ${what}.`;
  return (
    <div className="rise w-full px-2">
      <div className="h-[2px] w-full bg-[var(--color-felt-line)]">
        <div className="h-full bg-[var(--color-chalk)]" style={{ width: `${ratio * 100}%` }} />
      </div>
      <div className="mt-1 flex items-center justify-center gap-3">
        <p className="text-center text-[13px] leading-snug text-[var(--color-chalk)]">{text}</p>
        {canSnap && (
          <button type="button" onClick={() => act({ type: 'PASS_SNAP' })} className="min-h-[32px] shrink-0 text-xs text-[var(--color-chalk-soft)] underline underline-offset-2">
            {claimer ? "c'est tout" : 'rien à poser'}
          </button>
        )}
      </div>
    </div>
  );
}

/** Le temps qui reste, quand la table a fixé une limite par tour. */
function TurnClock({ turn, now, receivedAt }) {
  if (turn?.remainingMs == null) return null;
  const left = Math.max(0, Math.ceil((turn.remainingMs - (now - receivedAt)) / 1000));
  return <span className={`font-mono text-xs ${left <= 10 ? 'text-[var(--color-red)]' : 'text-[var(--color-chalk-soft)]'}`}>{left}s</span>;
}

function Prompt({ view, seated, stage, power, takingDiscard, setTakingDiscard, turnPlayer, swapOwn, swapTarget, gaboArmed, setGaboArmed, byId, now, receivedAt, canSnap }) {
  const round = view.round;
  const isHost = view.you === view.hostId;

  if (view.phase === 'peek') {
    const ready = round.ready.includes(view.you);
    const waiting = round.seats.filter((id) => !round.ready.includes(id) && byId[id] && !byId[id].bot && byId[id].connected);
    return (
      <Line>
        {seated && !ready ? (
          <>
            <Say>Retiens tes deux cartes du bas.</Say>
            <button type="button" className="btn btn-paper" onClick={() => act({ type: 'READY' })}>
              C'est retenu
            </button>
          </>
        ) : (
          <span className="text-sm text-[var(--color-chalk-soft)]">On attend {waiting.map((id) => byId[id]?.name).join(', ') || 'tout le monde'}…</span>
        )}
        {isHost && ready && waiting.length > 0 && (
          <button type="button" className="text-xs text-[var(--color-chalk-soft)] underline" onClick={() => act({ type: 'FORCE_START' })}>
            commencer sans attendre
          </button>
        )}
      </Line>
    );
  }
  if (!seated) return null;
  if (canSnap && !stage) return <Line><Say>Pose vite, ou laisse filer.</Say></Line>;

  const top = round.discardTop;
  if (stage === 'start') {
    if (takingDiscard) {
      return (
        <Line>
          <Say>Quelle carte remplace {top ? definite(top) : 'la défausse'} ?</Say>
          <button type="button" className="btn btn-line" onClick={() => setTakingDiscard(false)}>Annuler</button>
        </Line>
      );
    }
    return (
      <Line>
        <Say>À toi.</Say>
        <span className="text-sm text-[var(--color-chalk-soft)]">Pioche, ou prends la défausse.</span>
        <TurnClock turn={round.turn} now={now} receivedAt={receivedAt} />
        {!round.gabo && (
          <button
            type="button"
            className={`btn ${gaboArmed ? 'btn-red' : 'btn-line'}`}
            onClick={() => (gaboArmed ? act({ type: 'CALL_GABO' }) : setGaboArmed(true))}
          >
            {gaboArmed ? 'Sûr ? Gabo !' : `Gabo (≤ ${view.settings.threshold})`}
          </button>
        )}
      </Line>
    );
  }
  if (stage === 'drawn') {
    const held = round.turn.held;
    const p = { 7: 'peekOwn', 8: 'peekOwn', 9: 'peekOther', 10: 'peekOther', J: 'swap', Q: 'swap' }[held?.rank];
    return (
      <Line>
        <Say>Garde-la : touche la carte à remplacer.</Say>
        <button type="button" className="btn btn-paper" onClick={() => act({ type: 'DISCARD_HELD' })}>
          Jeter {definite(held)}
        </button>
        {p && <span className="w-full text-center text-[11px] leading-tight text-[var(--color-chalk-soft)]">Jetée, elle donne un pouvoir : {POWER_TEXT[p].toLowerCase()}.</span>}
      </Line>
    );
  }
  if (stage === 'power') {
    let text;
    if (power === 'peekOwn') text = 'Touche une de tes cartes pour la regarder.';
    else if (power === 'peekOther') text = "Touche une carte d'une adversaire pour la regarder.";
    else if (swapOwn == null && !swapTarget) text = 'Choisis la carte que tu donnes, et celle que tu prends.';
    else if (swapOwn == null) text = `Prise chez ${byId[swapTarget.ownerId]?.name}. Laquelle donnes-tu ?`;
    else if (!swapTarget) text = 'Laquelle prends-tu, en face ?';
    else text = 'Échanger ces deux cartes ?';
    return (
      <Line>
        <Say>{text}</Say>
        {power === 'swap' && swapOwn != null && swapTarget && (
          <button type="button" className="btn btn-paper" onClick={() => act({ type: 'USE_POWER', ownSlot: swapOwn, target: swapTarget })}>
            Échanger
          </button>
        )}
        <button type="button" className="btn btn-line" onClick={() => act({ type: 'SKIP_POWER' })}>
          Passer
        </button>
      </Line>
    );
  }
  if (stage === 'snap') return <Line><span className="text-sm text-[var(--color-chalk-soft)]">Tour joué. Les autres peuvent poser.</span></Line>;
  if (turnPlayer) {
    return (
      <Line>
        <span className="text-sm text-[var(--color-chalk-soft)]">
          C'est à <span className="font-semibold text-[var(--color-chalk)]">{turnPlayer.name}</span>
          {!turnPlayer.connected && !turnPlayer.bot ? ' — absente, son tour se jouera seul' : ''}
        </span>
        <TurnClock turn={round.turn} now={now} receivedAt={receivedAt} />
        {!turnPlayer.bot && turnPlayer.connected && (
          <button
            type="button"
            className="flex min-h-[32px] items-center gap-1 text-xs text-[var(--color-chalk-soft)] hover:text-[var(--color-chalk)]"
            onClick={() => socket.emit('gabo:nudge', { playerId: turnPlayer.id })}
          >
            <IconHurry width={14} height={14} /> presser
          </button>
        )}
      </Line>
    );
  }
  return null;
}

function Line({ children }) {
  return <div className="flex min-h-[2.6rem] flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">{children}</div>;
}

function Say({ children }) {
  return <span className="font-display text-[1.05rem] text-[var(--color-chalk)] italic">{children}</span>;
}
