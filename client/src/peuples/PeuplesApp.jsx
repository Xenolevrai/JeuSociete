/**
 * La table des Sept Peuples.
 *
 * Le client n'a aucune règle : il affiche la vue que le serveur lui a taillée
 * (sa main en clair, celles des autres réduites à un nombre) et envoie des
 * intentions. Tout ce qui n'est pas une décision attendue — réordonner sa
 * main, la mélanger, parler — peut se faire à tout moment.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { sendAction, socket } from '../lib/socket.js';
import Card from './Card.jsx';
import PeuplesLobby from './PeuplesLobby.jsx';
import { GameOverDialog, LogPanel, PeopleRow, RulesDialog } from './PeuplesPanels.jsx';
import { useText, withArticle } from './text.js';
import { raceOf } from '../../../shared/peuples.js';

const nameOf = (state, id) => state.players.find((p) => p.id === id)?.name ?? '?';

/** Une adversaire en face autour de la table. */
function Seat({ player, t, active, awaited, scoring }) {
  const handCount = player.handCount ?? 0;
  const maxShown = Math.min(handCount, 12);

  return (
    <div
      className={`peuples-panel flex flex-col rounded-sm p-3 transition-all ${
        active || awaited ? 'ring-2 ring-[color:var(--pp-accent)] shadow-md' : ''
      } ${player.connected || player.bot ? '' : 'opacity-60'}`}
    >
      {/* 1. Profil et statut de l'adversaire */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--pp-rule)]/40 pb-2">
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-black shadow" style={{ background: player.color }} />
          <span className="font-semibold text-base" style={{ color: player.color }}>
            {player.name}
          </span>
          {player.bot && (
            <span className="rounded bg-[color:var(--pp-well)] px-1.5 py-0.5 text-[9px] uppercase tracking-wide">
              {t.bot}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(active || awaited) && (
            <span className="pp-caps bg-[#7d2018] px-2 py-0.5 text-[10px] text-[#f6ecd2] rounded-xs shadow animate-pulse">
              {awaited ? t.thinking : t.theirTurn}
            </span>
          )}
          <span className="text-xs text-[color:var(--pp-ink-soft)] font-medium">
            {t.cards(handCount)}
          </span>
        </div>
      </div>

      {/* 2. Main de l'adversaire : tenue en main face à nous (dos des cartes visible) */}
      <div className="my-2.5 flex flex-col items-center justify-center">
        <p className="pp-caps text-[10px] text-[color:var(--pp-ink-soft)]/70 mb-1">
          Cartes en main · {handCount}
        </p>
        {handCount > 0 ? (
          <div className="flex items-center justify-center pt-2 pb-1" style={{ minHeight: '5.5rem' }}>
            {Array.from({ length: maxShown }, (_, i) => {
              const offset = i - (maxShown - 1) / 2;
              const rotate = offset * 4;
              const translateY = Math.abs(offset) * 2;
              return (
                <div
                  key={i}
                  className="-ml-6 sm:-ml-7 first:ml-0 transition-transform duration-200 shadow-md hover:-translate-y-1"
                  style={{
                    transform: `rotate(${rotate}deg) translateY(${translateY}px)`,
                    zIndex: i + 1,
                  }}
                  title={`Carte de ${player.name} (${i + 1}/${handCount})`}
                >
                  <Card size="sm" faceDown t={t} />
                </div>
              );
            })}
            {handCount > maxShown && (
              <span className="ml-2 text-xs font-bold text-[color:var(--pp-accent)]">
                +{handCount - maxShown}
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs italic text-[color:var(--pp-ink)]/40 py-2">
            Aucune carte en main
          </p>
        )}
      </div>

      {/* 3. Cartes posées par l'adversaire sur la table (son peuple) */}
      <div className="mt-auto border-t border-[color:var(--pp-rule)]/40 pt-2">
        <div className="mb-1.5 flex items-center justify-between px-1">
          <span className="pp-caps text-[11px] text-[color:var(--pp-ink-soft)] font-semibold">
            {t.people} de {player.name}
          </span>
          <span className="text-xs text-[color:var(--pp-ink)] font-bold">
            {t.members(player.people.length)}
          </span>
        </div>
        <PeopleRow
          people={player.people}
          scoring={scoring}
          t={t}
          size="sm"
          emptyText={`Aucune carte posée par ${player.name}`}
        />
      </div>
    </div>
  );
}

/** L'effet en cours : qui vise qui, avec quoi, et la chaîne de fées. */
function EffectBanner({ state, t }) {
  const effect = state.effect;
  if (!effect) return null;
  const attacker = state.players.find((p) => p.id === effect.attackerId);
  const target = state.players.find((p) => p.id === effect.targetId);
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-sm bg-[color:var(--pp-well)] px-3 py-2">
      <span className="font-semibold" style={{ color: attacker.color }}>
        {attacker.name}
      </span>
      <Card race={effect.power} t={t} size="xs" />
      <span className="text-[color:var(--pp-accent)]">➹</span>
      <span className="font-semibold" style={{ color: target.color }}>
        {target.name}
      </span>
      {effect.cardId && <Card cardId={effect.cardId} t={t} size="xs" />}
      {effect.give && (
        <span className="text-sm">
          {t.racePlural[effect.give]} ⇄ {t.racePlural[effect.take]}
        </span>
      )}
      {effect.fairies > 0 && (
        <span className="flex items-center gap-1">
          {Array.from({ length: effect.fairies }, (_, i) => (
            <span key={i} className="peuples-deal">
              <Card race="fee" t={t} size="xs" />
            </span>
          ))}
          <span className="ml-1 text-xs text-[#cfe0ff]">{effect.fairies % 2 ? '✖' : '✔'}</span>
        </span>
      )}
    </div>
  );
}

/** Ce que fait la table quand ce n'est pas à nous de décider. */
function statusLine(state, t, me) {
  const pending = state.pending;
  if (state.phase === 'finished') return t.gameOver;
  if (!pending.kind) return '';
  if (me && pending.playerIds.includes(me.id)) return t.yourMove;
  const who = nameOf(state, pending.playerIds[0]);
  switch (pending.kind) {
    case 'play_card':
      return t.turnOf(who);
    case 'counter':
      return t.deciding(who);
    case 'korrigan_pick':
      return t.picking(who);
    default:
      return t.waitingFor(who);
  }
}

/**
 * Le farfadet des familles : on choisit chez qui, quelle famille prendre, et
 * quelle famille de son propre peuple céder en échange — puis on valide.
 */
function FamilySwapPicker({ state, me, t, payload, act }) {
  const targets = payload.targets.map((id) => state.players.find((p) => p.id === id));
  const [targetId, setTargetId] = useState(targets.length === 1 ? targets[0].id : null);
  const [take, setTake] = useState(null);
  const [give, setGive] = useState(null);
  const target = targets.find((p) => p.id === targetId);
  const mine = me.people.filter((id) => payload.give.includes(raceOf(id)));
  return (
    <div className="space-y-3">
      <p className="text-center">{t.swapTitle}</p>
      {targets.length > 1 && (
        <div className="flex flex-wrap justify-center gap-2">
          {targets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setTargetId(p.id);
                setTake(null);
              }}
              className={`flex items-center gap-2 rounded-sm px-3 py-1.5 ${p.id === targetId ? 'btn-gold' : 'btn-ghost'}`}
            >
              <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
              {p.name}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="bg-[color:var(--pp-well)] p-2">
          <p className="pp-caps mb-1 text-[10px] text-[color:var(--pp-ink-soft)]">
            {target ? t.swapTake(target.name) : t.swapPickTarget}
          </p>
          {target && <PeopleRow people={target.people} t={t} size="sm" pickable onPick={(id) => setTake(raceOf(id))} />}
          {take && <p className="mt-1 text-sm font-semibold">→ {t.racePlural[take]}</p>}
        </div>
        <div className="bg-[color:var(--pp-well)] p-2">
          <p className="pp-caps mb-1 text-[10px] text-[color:var(--pp-ink-soft)]">{t.swapGive}</p>
          <PeopleRow people={mine} t={t} size="sm" pickable onPick={(id) => setGive(raceOf(id))} />
          {give && <p className="mt-1 text-sm font-semibold">← {t.racePlural[give]}</p>}
          <p className="mt-1 text-xs italic text-[color:var(--pp-ink-soft)]">{t.swapKeeps(t.racePlural[payload.viaElf ? 'elfe' : 'farfadet'])}</p>
        </div>
      </div>
      <div className="text-center">
        <button
          type="button"
          disabled={!targetId || !take || !give}
          onClick={() => act({ type: 'CHOOSE_TARGET', targetId, give, take })}
          className="btn-gold rounded-sm px-6 py-2"
        >
          {t.confirm}
        </button>
      </div>
    </div>
  );
}

/** La décision attendue de ce poste, posée juste au-dessus de sa main. */
function Decision({ state, me, t, selected, onShuffle }) {
  const pending = state.pending;
  const [picked, setPicked] = useState([]);
  useEffect(() => setPicked([]), [pending.kind, state.version]);
  if (!me || !pending.kind || !pending.playerIds.includes(me.id)) return null;
  const act = (action) => sendAction(action, me.id);
  const payload = pending.payload ?? {};
  const hasFairy = me.hand?.some((id) => raceOf(id) === 'fee');

  let body;
  switch (pending.kind) {
    case 'play_card':
      body = (
        <div className="space-y-2.5 text-center">
          <p className="font-fable text-2xl text-[color:var(--pp-accent)]">
            {t.yourMove ?? 'À vous de jouer !'}
          </p>
          <p className="text-sm text-[color:var(--pp-ink)]">
            {selected ? (
              <span>
                Carte prête à poser :{' '}
                <b className="text-[color:var(--pp-accent)] text-base">{t.race[raceOf(selected)]}</b>
              </span>
            ) : (
              <span className="italic text-[color:var(--pp-ink-soft)]">
                {t.pickToPlay}
              </span>
            )}
          </p>
          <div className="flex justify-center pt-1">
            <button
              type="button"
              disabled={!selected}
              onClick={() => sendAction({ type: 'PLAY_CARD', cardId: selected }, me.id)}
              className={`btn-gold rounded-sm px-6 py-2.5 font-bold text-sm shadow-md transition-all ${
                selected ? 'scale-105 shadow-[0_0_15px_rgba(227,185,100,0.5)]' : 'opacity-40 cursor-not-allowed'
              }`}
            >
              {selected ? `Poser ${t.race[raceOf(selected)]}` : t.playShort}
            </button>
          </div>
        </div>
      );
      break;

    case 'elf_copy':
      body = (
        <div className="space-y-2 text-center">
          <p>{t.elfTitle}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {payload.races.map((race) => (
              <Card key={race} race={race} t={t} size="md" onClick={() => act({ type: 'ELF_COPY', race })} />
            ))}
          </div>
        </div>
      );
      break;

    case 'choose_target': {
      const targets = payload.targets.map((id) => state.players.find((p) => p.id === id));
      body = payload.familySwap ? (
        <FamilySwapPicker state={state} me={me} t={t} payload={payload} act={act} />
      ) :
        payload.power === 'dryade' ? (
          <div className="space-y-2">
            <p className="text-center">{t.dryadTitle}</p>
            {targets.map((target) => (
              <div key={target.id} className="rounded-sm bg-[color:var(--pp-well)] p-2">
                <p className="mb-1 text-sm font-semibold" style={{ color: target.color }}>
                  {target.name}
                </p>
                <PeopleRow
                  people={target.people}
                  t={t}
                  size="sm"
                  pickable
                  onPick={(cardId) => act({ type: 'CHOOSE_TARGET', targetId: target.id, cardId })}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2 text-center">
            <p>{t.targetTitle(withArticle(t, payload.power))}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {targets.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => act({ type: 'CHOOSE_TARGET', targetId: target.id })}
                  className="btn-ghost flex items-center gap-2 rounded-sm px-4 py-2"
                >
                  <span className="h-3 w-3 rounded-full" style={{ background: target.color }} />
                  <b>{target.name}</b>
                  <span className="text-xs text-[color:var(--pp-ink)]/70">
                    {t.cards(target.handCount)} · {t.people} {target.people.length}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      break;
    }

    case 'counter': {
      const defend = payload.role === 'defend';
      const attacker = nameOf(state, payload.attackerId);
      const target = nameOf(state, payload.targetId);
      const question = defend
        ? payload.fairies === 0
          ? t.counterDefend(attacker, withArticle(t, payload.power))
          : t.counterDefendAgain(attacker)
        : t.counterInsist(target);
      body = (
        <div className="space-y-3 text-center">
          <p className="text-lg font-semibold">{question}</p>
          {defend && payload.power === 'korrigan' && (
            <p className="text-sm text-[color:var(--pp-ink)]/75">
              {t.korriganHint}{' '}
              <button type="button" onClick={onShuffle} className="btn-ghost ml-1 rounded px-2 py-0.5 text-xs">
                ⤨ {t.shuffle}
              </button>
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              disabled={!hasFairy}
              onClick={() => act({ type: 'PLAY_FAIRY' })}
              className="btn-gold flex items-center gap-2 rounded-sm px-4 py-2"
            >
              <span className="text-[#2a3f86]">✦</span> {defend ? t.playFairy : t.counterFairy}
            </button>
            {/* Toujours proposé, avec ou sans fée : on ne trahit pas sa main. */}
            <button type="button" onClick={() => act({ type: 'DECLINE_FAIRY' })} className="btn-ghost rounded-sm px-4 py-2">
              {defend ? t.noFairy : t.noCounter}
            </button>
          </div>
          {!hasFairy && <p className="text-xs italic text-[color:var(--pp-ink)]/50">{t.noFairyInHand}</p>}
        </div>
      );
      break;
    }

    case 'korrigan_pick': {
      const toggle = (i) =>
        setPicked((list) =>
          list.includes(i) ? list.filter((x) => x !== i) : list.length < payload.count ? [...list, i] : list,
        );
      body = (
        <div className="space-y-3 text-center">
          <p>{t.pickTitle(payload.count, nameOf(state, payload.targetId))}</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {Array.from({ length: payload.handSize }, (_, i) => (
              <Card key={i} t={t} size="sm" faceDown selected={picked.includes(i)} onClick={() => toggle(i)} />
            ))}
          </div>
          <button
            type="button"
            disabled={picked.length !== payload.count}
            onClick={() => act({ type: 'PICK_BLIND', indices: picked })}
            className="btn-gold rounded-sm px-6 py-2"
          >
            {t.confirm}
          </button>
        </div>
      );
      break;
    }

    default:
      body = null;
  }

  return <div className="rounded-sm border-2 border-[color:var(--pp-accent)] bg-[#fbf6e6] p-3 shadow-[inset_0_0_0_3px_#fbf6e6,inset_0_0_0_4px_rgba(125,32,24,.35)]">{body}</div>;
}

/**
 * Sa main : on la réordonne en faisant glisser une carte (souris) ou avec les
 * flèches (au doigt, où le glisser-déposer HTML ne se déclenche pas), et on la
 * mélange d'un bouton — précieux quand un korrigan rôde.
 */
function Hand({ me, t, selected, setSelected, canPlay, onShuffle }) {
  const hand = me.hand ?? [];
  const dragFrom = useRef(null);
  const reorder = (order) => sendAction({ type: 'REORDER_HAND', order }, me.id);
  const move = (from, to) => {
    if (to < 0 || to >= hand.length || from === to) return;
    const order = [...hand];
    const [card] = order.splice(from, 1);
    order.splice(to, 0, card);
    reorder(order);
  };
  const index = hand.indexOf(selected);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="pp-caps text-[11px] text-[color:var(--pp-ink-soft)]/70">
          {t.hand} · {hand.length}
        </p>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            disabled={index <= 0}
            onClick={() => move(index, index - 1)}
            className="btn-ghost h-9 w-9 rounded-sm"
            aria-label={t.moveLeft}
          >
            ◀
          </button>
          <button
            type="button"
            disabled={index < 0 || index >= hand.length - 1}
            onClick={() => move(index, index + 1)}
            className="btn-ghost h-9 w-9 rounded-sm"
            aria-label={t.moveRight}
          >
            ▶
          </button>
          <button type="button" onClick={onShuffle} disabled={hand.length < 2} className="btn-ghost h-9 whitespace-nowrap rounded-sm px-3 text-sm">
            ⤨ {t.shuffle}
          </button>
          {canPlay && (
            <button
              type="button"
              disabled={!selected}
              onClick={() => sendAction({ type: 'PLAY_CARD', cardId: selected }, me.id)}
              className="btn-gold h-9 whitespace-nowrap rounded-sm px-4 font-semibold"
            >
              <span className="sm:hidden">{t.playShort}</span>
              <span className="hidden sm:inline">{t.play}</span>
            </button>
          )}
        </div>
      </div>
      <div className="scroll-thin flex min-h-[10rem] items-end overflow-x-auto px-2 pb-2 pt-4 sm:min-h-[12rem]">
        {hand.map((cardId, i) => (
          <div
            key={cardId}
            draggable
            onDragStart={() => (dragFrom.current = i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragFrom.current != null) move(dragFrom.current, i);
              dragFrom.current = null;
            }}
            className="-ml-5 first:ml-0 sm:-ml-4"
            style={{ zIndex: cardId === selected ? 20 : i }}
          >
            <Card
              cardId={cardId}
              t={t}
              size="lg"
              selected={cardId === selected}
              onClick={() => setSelected(cardId === selected ? null : cardId)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function Table({ game }) {
  const { state, me, mine, leave } = game;
  const t = useText(state.locale, state.settings);
  const [selected, setSelected] = useState(null);
  const [rules, setRules] = useState(false);
  const [recapClosed, setRecapClosed] = useState(false);
  const decisionRef = useRef(null);

  const pending = state.pending;
  const myDecision = Boolean(pending.kind && me && pending.playerIds.includes(me.id));
  const canPlay = pending.kind === 'play_card' && myDecision;

  // Une carte sélectionnée qui a quitté la main (posée, volée, échangée) ne
  // doit pas rester « choisie ».
  useEffect(() => {
    if (selected && !me?.hand?.includes(selected)) setSelected(null);
  }, [state.version]);

  // Quand la table attend une décision de ce poste, on la ramène sous les yeux.
  useEffect(() => {
    if (myDecision) decisionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [myDecision, pending.kind]);

  useEffect(() => {
    if (state.phase === 'finished') setRecapClosed(false);
  }, [state.phase]);

  // Les adversaires, dans l'ordre où elles jouent après nous.
  const seats = useMemo(() => {
    const start = Math.max(0, state.players.findIndex((p) => p.id === me?.id));
    return [...state.players.slice(start + 1), ...state.players.slice(0, start)].filter((p) => p.id !== me?.id);
  }, [state.players, me?.id]);

  const current = state.players[state.currentIndex];
  const shuffle = () => me && sendAction({ type: 'SHUFFLE_HAND' }, me.id);
  const last = state.lastPlayed;
  const recent = state.log.filter((e) => ['play', 'power', 'fairy', 'pass', 'setup', 'target'].includes(e.type)).slice(-3);

  return (
    <div className="peuples-bg min-h-screen">
      <header className="peuples-paper sticky top-0 z-30 flex flex-wrap items-center gap-x-4 gap-y-1 !border-x-0 !border-t-0 px-3 py-2">
        <span className="font-fable gold-text text-xl">{t.title}</span>
        <span className="tabular font-condensed tracking-[0.2em] text-[color:var(--pp-accent)]">{state.code}</span>
        <span className="text-xs text-[color:var(--pp-ink)]/65">
          {t.turn} {state.turnCount} · {t.deck} {state.deckCount}
        </span>
        {state.finalRound && (
          <span className="rounded-sm bg-[#b3202b] px-2 py-0.5 text-[11px] uppercase tracking-wide text-white">{t.finalRound}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => setRules(true)} className="btn-ghost rounded-sm px-3 py-1 text-xs">
            {t.rulesTitle}
          </button>
          {state.phase === 'playing' && (
            <button
              type="button"
              onClick={() => window.confirm(t.endGameConfirm) && socket.emit('game:end')}
              className="btn-ghost rounded-sm px-3 py-1 text-xs"
            >
              {t.endGame}
            </button>
          )}
          <button type="button" onClick={leave} className="btn-ghost rounded-sm px-3 py-1 text-xs">
            {t.leave}
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="flex min-w-0 flex-col gap-4">
          {/* En face de nous : l'adversaire (ou les adversaires), sa main tenue et ses cartes posées */}
          <div className={`grid gap-3 ${seats.length > 1 ? 'sm:grid-cols-2' : ''} ${seats.length > 2 ? 'lg:grid-cols-3' : ''}`}>
            {seats.map((player) => (
              <Seat
                key={player.id}
                player={player}
                t={t}
                scoring={state.settings?.scoring}
                active={current?.id === player.id && state.phase === 'playing'}
                awaited={pending.playerIds.includes(player.id)}
              />
            ))}
          </div>

          {/* Le centre de la table : la pioche, la dernière carte posée, et la zone d'action */}
          <section className="peuples-felt flex flex-col gap-4 rounded-sm p-4 shadow-lg border border-[color:var(--pp-rule)]/30">
            <div className="grid grid-cols-2 items-center gap-4 sm:grid-cols-[auto_auto_1fr]">
              <div className="flex flex-col items-center gap-1">
                {state.deckCount > 0 ? (
                  // L'épaisseur de la pile suit ce qu'il en reste.
                  <div className="relative" style={{ paddingRight: Math.min(8, state.deckCount / 5), paddingBottom: Math.min(8, state.deckCount / 5) }}>
                    {state.deckCount > 1 && (
                      <div className="absolute bottom-0 right-0 aspect-[2/3] w-24 rounded-[5%] border border-black bg-[#2a1a12] sm:w-28" />
                    )}
                    <Card t={t} size="md" faceDown />
                  </div>
                ) : (
                  <div className="flex aspect-[2/3] w-24 items-center justify-center rounded-sm border border-dashed border-[color:var(--pp-rule)] text-center text-xs text-[color:var(--pp-ink)]/45 sm:w-28">
                    {t.deckEmpty}
                  </div>
                )}
                <span className="text-xs text-[color:var(--pp-ink)]/80 font-medium">
                  {t.deck} · {state.deckCount}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1">
                {last ? (
                  <div key={`${last.cardId}-${last.at}`} className="peuples-deal">
                    <Card cardId={last.cardId} t={t} size="lg" />
                  </div>
                ) : (
                  <div className="flex aspect-[2/3] w-32 items-center justify-center rounded-sm border border-dashed border-[color:var(--pp-rule)] text-center text-xs text-[color:var(--pp-ink)]/45 sm:w-36">
                    {t.lastPlayed}
                  </div>
                )}
                <span className="text-xs text-[color:var(--pp-ink)]/80 font-medium">
                  {last ? `${t.lastPlayed} · ${nameOf(state, last.playerId)}` : t.lastPlayed}
                </span>
              </div>
              <div className="col-span-2 min-w-0 space-y-3 text-center sm:col-span-1 sm:text-left">
                <div ref={decisionRef}>
                  {myDecision ? (
                    <Decision state={state} me={me} t={t} selected={selected} onShuffle={shuffle} />
                  ) : (
                    <>
                      <p className="font-fable text-2xl text-[color:var(--pp-accent)]">{statusLine(state, t, me)}</p>
                      <EffectBanner state={state} t={t} />
                      <ul className="space-y-1 text-sm text-[color:var(--pp-ink)]/80">
                        {recent.map((entry) => (
                          <li key={entry.id} className="fade-in">
                            {entry.text}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
                {myDecision && <EffectBanner state={state} t={t} />}
              </div>
            </div>
          </section>

          {/* Devant moi : mes cartes déjà posées (mon peuple) et ma main */}
          {me && (
            <section className="peuples-panel space-y-4 rounded-sm p-4 shadow-md">
              <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--pp-rule)]/40 pb-2">
                <span className="h-3.5 w-3.5 rounded-full border border-black shadow" style={{ background: me.color }} />
                <span className="font-semibold text-base">{mine.length > 1 ? t.handOf(me.name) : me.name}</span>
                <span className="pp-caps text-[11px] text-[color:var(--pp-ink-soft)] font-medium">
                  · {t.yourPeople} · {t.members(me.people.length)}
                </span>
                {state.settings?.scoring === 'families' && (
                  <span className="rounded bg-[color:var(--pp-well)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--pp-accent)]">
                    Décompte aux familles
                  </span>
                )}
                {mine.length > 1 && (
                  <span className="ml-auto text-xs text-[color:var(--pp-ink)]/50">
                    {mine.filter((p) => p.id !== me.id).map((p) => `${p.name} : ${t.cards(p.handCount)}`).join(' · ')}
                  </span>
                )}
              </div>

              {/* Vos cartes posées sur la table */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <p className="pp-caps text-[11px] font-bold text-[color:var(--pp-ink-soft)]">
                    Vos cartes posées sur la table ({me.people.length})
                  </p>
                  {state.settings?.scoring === 'families' && (
                    <span className="text-[11px] italic text-[color:var(--pp-ink-soft)]">
                      Triées par famille (les plus grandes en premier)
                    </span>
                  )}
                </div>
                <PeopleRow
                  people={me.people}
                  scoring={state.settings?.scoring}
                  t={t}
                  size="sm"
                  emptyText="Vous n'avez pas encore posé de cartes sur la table."
                />
              </div>

              {/* Ma main */}
              <div className="border-t border-[color:var(--pp-rule)]/40 pt-3">
                <Hand
                  me={me}
                  t={t}
                  selected={selected}
                  setSelected={setSelected}
                  canPlay={canPlay}
                  onShuffle={shuffle}
                />
              </div>
            </section>
          )}
        </main>

        <aside className="xl:sticky xl:top-[60px] xl:h-[calc(100dvh-72px)]">
          <LogPanel
            state={state}
            t={t}
            me={me ?? mine[0]}
            onChat={(text) => sendAction({ type: 'CHAT', text }, (me ?? mine[0])?.id)}
            className="h-[360px] xl:h-full"
          />
        </aside>
      </div>

      {rules && <RulesDialog t={t} settings={state.settings} onClose={() => setRules(false)} />}
      {state.phase === 'finished' && state.result && !recapClosed && (
        <GameOverDialog state={state} t={t} onClose={() => setRecapClosed(true)} onLeave={leave} />
      )}
    </div>
  );
}

export default function PeuplesApp({ game }) {
  const { state, mine, error, connected, setError, leave } = game;
  const t = useText(state?.locale);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timer);
  }, [error]);

  return (
    <>
      {!connected && (
        <div className="fixed inset-x-0 top-0 z-[60] bg-[#b3202b] py-1.5 text-center text-xs text-white">{t.connectionLost}</div>
      )}
      {error && (
        <div className="fade-in fixed left-1/2 top-14 z-[60] -translate-x-1/2 rounded-sm peuples-paper px-4 py-2 text-sm text-[#7d2018]">
          {error}
        </div>
      )}
      {state.phase === 'lobby' ? <PeuplesLobby state={state} mine={mine} onLeave={leave} /> : <Table game={game} />}
    </>
  );
}

