import { useEffect, useMemo, useState } from 'react'
import charactersRaw from '../data/characters.json'
import eventsRaw from '../data/events.json'
import { advanceTurn, applyChoice, beginGame, continueEndless, FALLBACK_ENV, newGame } from '../engine/game'
import { fetchEnvironment } from '../engine/live'
import { clearSave, loadGame, saveGame } from '../engine/persistence'
import { parseCharacters, parseEvents } from '../engine/validate'
import type { CharactersFile, Environment, EventsFile, GameState } from '../types'

interface Content { characters: CharactersFile; events: EventsFile }

function loadContent(): Content | { error: string } {
  try {
    return { characters: parseCharacters(charactersRaw), events: parseEvents(eventsRaw) }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Invalid content' }
  }
}

export function useGame() {
  const content = useMemo(() => loadContent(), [])
  const [state, setState] = useState<GameState | null>(() => loadGame())

  useEffect(() => {
    if (state) saveGame(state)
  }, [state])

  // Refresh weather/TTC in the background on load and whenever a new day's event appears.
  // Play never waits on it: choices use the latest snapshot (or the offline fallback).
  const [env, setEnv] = useState<Environment>(FALLBACK_ENV)
  const envKey = state ? `${state.turn}:${state.currentEventId}` : 'idle'
  useEffect(() => {
    let live = true
    void fetchEnvironment().then((e) => { if (live) setEnv(e) })
    return () => { live = false }
  }, [envKey])

  const ok = 'error' in content ? null : content
  const char = ok && state ? ok.characters.classes.find((c) => c.class_id === state.characterId) : undefined
  // Save refers to a character no longer in the content: treat as no save.
  const effective = char ? state : null
  const event =
    ok && effective?.currentEventId
      ? ok.events.events_catalog.find((e) => e.event_id === effective.currentEventId) ?? null
      : null

  const start = (classId: string) => {
    if (!ok) return
    const c = ok.characters.classes.find((x) => x.class_id === classId)
    if (c) setState(beginGame(newGame(c, Date.now()), ok.events))
  }

  const choose = (key: 'choice_a' | 'choice_b') => {
    if (!ok || !effective || !event || !char) return
    setState(applyChoice(effective, event, key, char, env))
  }

  const next = () => {
    if (ok && effective) setState(advanceTurn(effective, ok.events, env))
  }

  const keepSurviving = () => {
    if (ok && effective) setState(continueEndless(effective, ok.events))
  }

  const reset = () => {
    clearSave()
    setState(null)
  }

  return {
    error: 'error' in content ? content.error : null,
    characters: ok?.characters.classes ?? [],
    state: effective, char, event, env,
    start, choose, next, reset, keepSurviving,
  }
}
