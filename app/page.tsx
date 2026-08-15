"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

type Mark = "pending" | "passed" | "correct" | "wrong";
type Relation = "EMPIEZA" | "CONTIENE";
type Word = { letter: string; relation: Relation; answer: string; clue: string; mark: Mark };
type TeamResult = { name: string; correct: number; wrong: number; elapsed: number };
type Mode = "solo" | "teams";
type SavedGame = { id: string; title: string; category: string; words: string; mode: Mode; duration: number; teamA: string; teamB: string };

const SAMPLE = `A | EMPIEZA | Agua | Vital líquido para los humanos
B | EMPIEZA | Biblioteca | Lugar donde se guardan y consultan libros
C | EMPIEZA | Corazón | Órgano que bombea la sangre
D | EMPIEZA | Dado | Cubo con puntos usado en juegos de azar
E | EMPIEZA | Elefante | El animal terrestre más grande
F | EMPIEZA | Faro | Torre con una luz que guía a los barcos
G | EMPIEZA | Guitarra | Instrumento musical de seis cuerdas
H | CONTIENE | Hielo | Agua en estado sólido`;

const AI_PROMPT = `CATEGORÍA: [ESCRIBE AQUÍ LA CATEGORÍA]\n\nCrea una lista de palabras de la categoría indicada para jugar Pasapalabras. Debe haber exactamente una línea y una respuesta distinta para cada letra del alfabeto español: nunca asignes dos respuestas a la misma letra y nunca reutilices una respuesta para otra letra. Cada línea debe contener exactamente: LETRA | TIPO | RESPUESTA | DESCRIPCIÓN. En TIPO escribe EMPIEZA cuando la respuesta comience por esa letra o CONTIENE cuando la respuesta contenga esa letra en cualquier posición. Prioriza EMPIEZA; usa CONTIENE solamente cuando sea difícil encontrar una opción natural. Comprueba que cada respuesta cumpla realmente el tipo indicado. No repitas ninguna respuesta en toda la lista, aunque una misma palabra pudiera servir para dos letras diferentes o para los tipos EMPIEZA y CONTIENE. Considera iguales las palabras que solo cambien en mayúsculas, minúsculas o tildes. Por ejemplo, no uses MÉXICO para M y nuevamente para X, ni KIWI para K y nuevamente para W. La descripción debe ser clara, breve y no mencionar ni revelar la respuesta. Ordena las líneas alfabéticamente y no agregues títulos, números, viñetas ni explicaciones. Ejemplos: A | EMPIEZA | Agua | Vital líquido para los humanos. Ñ | CONTIENE | Niño | Persona que está en la etapa de la infancia.`;

function parse(text: string): Word[] {
  return text.split("\n").map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const parts = line.split(/\s*[|;\t]\s*/);
    const explicitLetter = parts.length > 2 && parts[0].length <= 2;
    const hasRelation = explicitLetter && /^(EMPIEZA|CONTIENE)$/i.test(parts[1] || "");
    return {
      letter: (explicitLetter ? parts[0] : String.fromCharCode(65 + index)).toUpperCase(),
      relation: (hasRelation ? parts[1].toUpperCase() : "EMPIEZA") as Relation,
      answer: (hasRelation ? parts[2] : explicitLetter ? parts[1] : parts[0])?.trim() || "",
      clue: (hasRelation ? parts.slice(3) : explicitLetter ? parts.slice(2) : parts.slice(1)).join(" | ").trim(),
      mark: "pending" as Mark,
    };
  }).filter((word) => word.answer && word.clue);
}

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function normalizeEntry(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es");
}

export default function Home() {
  const [view, setView] = useState<"setup" | "game" | "between" | "done">("setup");
  const [raw, setRaw] = useState(SAMPLE);
  const [mode, setMode] = useState<Mode>("solo");
  const [teamNames, setTeamNames] = useState(["Equipo A", "Equipo B"]);
  const [duration, setDuration] = useState(120);
  const [remaining, setRemaining] = useState(120);
  const [running, setRunning] = useState(false);
  const [words, setWords] = useState<Word[]>([]);
  const [current, setCurrent] = useState(0);
  const [teamIndex, setTeamIndex] = useState(0);
  const [results, setResults] = useState<TeamResult[]>([]);
  const [showAnswer, setShowAnswer] = useState(true);
  const [copied, setCopied] = useState(false);
  const [listCopied, setListCopied] = useState(false);
  const [gameTitle, setGameTitle] = useState("Mi Pasapalabras");
  const [category, setCategory] = useState("General");
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [saving, setSaving] = useState(false);
  const [liveId, setLiveId] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const ready = useMemo(() => parse(raw), [raw]);
  const validationIssues = useMemo(() => {
    const repeatedLetters = [...new Set(ready.map((word) => word.letter).filter((letter, index, all) => all.indexOf(letter) !== index))];
    const normalizedAnswers = ready.map((word) => normalizeEntry(word.answer));
    const repeatedAnswers = [...new Set(ready.filter((_word, index) => normalizedAnswers.indexOf(normalizedAnswers[index]) !== index).map((word) => word.answer))];
    const issues: string[] = [];
    if (repeatedLetters.length) issues.push(`Letras repetidas: ${repeatedLetters.join(", ")}. Debe haber una sola palabra por letra.`);
    if (repeatedAnswers.length) issues.push(`Respuestas repetidas: ${repeatedAnswers.join(", ")}. Cada palabra debe usarse una sola vez.`);
    return issues;
  }, [ready]);
  const validList = ready.length > 0 && validationIssues.length === 0;
  const active = words[current];
  const correct = words.filter((word) => word.mark === "correct").length;
  const wrong = words.filter((word) => word.mark === "wrong").length;
  const open = words.filter((word) => word.mark === "pending" || word.mark === "passed").length;

  useEffect(() => {
    if (!running || view !== "game") return;
    if (remaining <= 0) {
      finishTurn();
      return;
    }
    const timer = window.setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [running, remaining, view]);

  useEffect(() => { loadSavedGames(); }, []);

  useEffect(() => {
    if (!liveId || view !== "game" || !active) return;
    const state = publicState(words, current, active, remaining, running, correct);
    fetch(`/api/live/${liveId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state }) });
  }, [liveId, words, current, remaining, running, view, teamIndex]);

  useEffect(() => {
    if (!liveId || !active) return;
    const heartbeat = () => {
      const state = publicState(words, current, active, remaining, running, correct);
      void fetch(`/api/live/${liveId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state }) });
    };
    const closeSession = () => { navigator.sendBeacon(`/api/live/${liveId}/close`); };
    const timer = window.setInterval(heartbeat, 5000);
    window.addEventListener("beforeunload", closeSession);
    return () => { window.clearInterval(timer); window.removeEventListener("beforeunload", closeSession); };
  }, [liveId, active, words, current, remaining, running, correct, teamIndex]);

  function publicState(list: Word[], index: number, word: Word, time: number, isRunning: boolean, points: number) {
    return { words: list.map(({ letter, mark }) => ({ letter, mark })), current: index, clue: word.clue, relation: `${word.relation === "EMPIEZA" ? "Empieza por" : "Contiene la"} ${word.letter}`, remaining: time, team: mode === "teams" ? teamNames[teamIndex] : "Ronda individual", correct: points, running: isRunning };
  }

  async function loadSavedGames() {
    const response = await fetch("/api/games", { cache: "no-store" });
    if (response.ok) setSavedGames(await response.json());
  }

  function freshWords() { return ready.map((word) => ({ ...word, mark: "pending" as Mark })); }

  async function start() {
    if (!validList) return;
    if (liveId) await fetch(`/api/live/${liveId}/close`, { method: "POST", keepalive: true });
    const list = freshWords();
    setWords(list); setCurrent(0); setTeamIndex(0); setResults([]);
    setRemaining(duration); setRunning(false); setView("game"); setLiveId("");
    const response = await fetch("/api/live", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gameTitle, state: publicState(list, 0, list[0], duration, false, 0) }) });
    if (response.ok) setLiveId(((await response.json()) as { id: string }).id);
  }

  async function saveGame() {
    if (!gameTitle.trim() || !category.trim() || !validList) return;
    setSaving(true);
    const response = await fetch("/api/games", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: gameTitle, category, words: raw, mode, duration, teamNames }) });
    setSaving(false); if (response.ok) await loadSavedGames();
  }

  function loadGame(game: SavedGame) {
    setGameTitle(game.title); setCategory(game.category); setRaw(game.words); setMode(game.mode); setDuration(game.duration); setRemaining(game.duration); setTeamNames([game.teamA, game.teamB]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function copyShareLink() {
    if (!liveId) return;
    await navigator.clipboard.writeText(`${window.location.origin}/audience/${liveId}`);
    setShareCopied(true); window.setTimeout(() => setShareCopied(false), 1800);
  }

  function nextOpen(from: number, list: Word[]) {
    const candidates = list.map((word, index) => ({ word, index })).filter(({ word }) => word.mark === "pending" || word.mark === "passed");
    if (!candidates.length) { finishTurn(list); return; }
    const next = candidates.find(({ index }) => index > from) || candidates[0];
    setCurrent(next.index);
  }

  function setMark(mark: "correct" | "wrong" | "passed") {
    const updated = words.map((word, index) => index === current ? { ...word, mark } : word);
    setWords(updated);
    nextOpen(current, updated);
  }

  function finishTurn(list = words) {
    setRunning(false);
    const turn: TeamResult = {
      name: mode === "teams" ? teamNames[teamIndex] : "Resultado",
      correct: list.filter((word) => word.mark === "correct").length,
      wrong: list.filter((word) => word.mark === "wrong").length,
      elapsed: duration - remaining,
    };
    const nextResults = [...results, turn];
    setResults(nextResults);
    if (mode === "teams" && teamIndex === 0) setView("between");
    else setView("done");
  }

  function startSecondTeam() {
    setTeamIndex(1); setWords(freshWords()); setCurrent(0); setRemaining(duration);
    setRunning(false); setView("game");
  }

  async function exitGame() {
    setRunning(false);
    if (liveId) await fetch(`/api/live/${liveId}/close`, { method: "POST", keepalive: true });
    setLiveId("");
    setView("setup");
  }

  function updateDuration(minutes: number, seconds: number) {
    const total = Math.max(10, Math.min(3599, minutes * 60 + seconds));
    setDuration(total); setRemaining(total);
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(AI_PROMPT);
    setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  }

  async function pasteList() {
    const text = await navigator.clipboard.readText();
    if (text) setRaw(text);
  }

  async function copyList() {
    await navigator.clipboard.writeText(raw);
    setListCopied(true); window.setTimeout(() => setListCopied(false), 1600);
  }

  if (view === "setup") return (
    <main className="setup-page">
      <Header />
      <section className="setup-wrap">
        <div className="setup-title"><span>Preparar partida</span><h1>Configura tu rosco</h1><p>Carga las palabras, elige el tipo de partida y ajusta el tiempo.</p></div>

        <div className="setup-card identity-card">
          <div className="section-head"><div className="step">0</div><div><h2>Identifica la partida</h2><p>Así podrás encontrarla después</p></div></div>
          <div className="identity-inputs"><label>Título<input value={gameTitle} onChange={(e) => setGameTitle(e.target.value)} placeholder="Ej. Geografía de Venezuela" /></label><label>Categoría<input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ej. Geografía" /></label></div>
          <button className="save-game" onClick={saveGame} disabled={saving || !validList || !gameTitle.trim() || !category.trim()}>{saving ? "Guardando…" : "Guardar partida"}</button>
        </div>

        <div className="setup-card">
          <div className="section-head"><div className="step">1</div><div><h2>Palabras y pistas</h2><p>{ready.length} palabras reconocidas</p></div></div>
          <textarea aria-label="Palabras de la ronda" value={raw} onChange={(event) => setRaw(event.target.value)} spellCheck={false} />
          {validationIssues.length > 0 && <div className="list-error" role="alert">{validationIssues.map((issue) => <p key={issue}>{issue}</p>)}</div>}
          <div className="list-tools"><button className="clear" onClick={() => setRaw("")}>Limpiar lista</button><div><button className="icon-tool" onClick={pasteList} aria-label="Pegar lista" title="Pegar lista"><span>↧</span> Pegar</button><button className="icon-tool" onClick={copyList} aria-label="Copiar lista" title="Copiar lista"><span>⧉</span> {listCopied ? "Copiada" : "Copiar"}</button></div></div>
        </div>

        <button
          type="button"
          className={`setup-card prompt-card prompt-copy-card${copied ? " copied" : ""}`}
          onClick={copyPrompt}
          aria-label="Copiar la instrucción completa para la IA"
        >
          <div className="step">AI</div>
          <div>
            <h2>Pídeselo a una IA</h2>
            <p aria-live="polite">{copied ? "✓ Instrucción copiada" : "Toca para copiar la instrucción"}</p>
          </div>
          <span className="copy-card-icon" aria-hidden="true">⧉</span>
        </button>

        <div className="setup-card options-card">
          <div className="section-head"><div className="step">2</div><div><h2>Tipo de partida</h2><p>Elige cómo quieren jugar</p></div></div>
          <div className="mode-toggle">
            <button className={mode === "solo" ? "selected" : ""} onClick={() => setMode("solo")}><strong>Individual</strong><span>Una sola ronda</span></button>
            <button className={mode === "teams" ? "selected" : ""} onClick={() => setMode("teams")}><strong>Equipos</strong><span>Mismas palabras</span></button>
          </div>
          {mode === "teams" && <div className="team-inputs">
            <label>Primer equipo<input value={teamNames[0]} onChange={(e) => setTeamNames([e.target.value, teamNames[1]])}/></label>
            <span>VS</span>
            <label>Segundo equipo<input value={teamNames[1]} onChange={(e) => setTeamNames([teamNames[0], e.target.value])}/></label>
          </div>}
        </div>

        <div className="setup-card timer-card">
          <div className="section-head"><div className="step">3</div><div><h2>Tiempo por ronda</h2><p>Por defecto: 2 minutos</p></div></div>
          <div className="time-inputs">
            <label><input type="number" min="0" max="59" value={Math.floor(duration / 60)} onChange={(e) => updateDuration(Number(e.target.value), duration % 60)}/><span>minutos</span></label>
            <b>:</b>
            <label><input type="number" min="0" max="59" value={duration % 60} onChange={(e) => updateDuration(Math.floor(duration / 60), Number(e.target.value))}/><span>segundos</span></label>
          </div>
        </div>

        <button className="start-button" onClick={start} disabled={!validList}>Comenzar partida <span>→</span></button>

        {savedGames.length > 0 && <section className="saved-section"><div><span>Biblioteca de partidas</span><h2>Partidas guardadas</h2></div><div className="saved-list">{savedGames.map((game) => <button key={game.id} onClick={() => loadGame(game)}><small>{game.category}</small><strong>{game.title}</strong><span>{game.mode === "teams" ? "Por equipos" : "Individual"} · {clock(game.duration)}</span></button>)}</div></section>}
      </section>
    </main>
  );

  if (view === "between") return (
    <main className="message-page"><section className="message-card"><span className="turn-done">✓</span><small>Turno completado</small><h1>{results[0].name}</h1><div className="turn-score"><strong>{results[0].correct}</strong><span>aciertos en {clock(results[0].elapsed)}</span></div><p>Ahora jugará <b>{teamNames[1]}</b> con exactamente las mismas palabras y el mismo tiempo.</p><button className="start-button" onClick={startSecondTeam}>Iniciar turno de {teamNames[1]}</button></section></main>
  );

  if (view === "done") {
    const ranked = [...results].sort((a, b) => b.correct - a.correct || a.elapsed - b.elapsed);
    return <main className="message-page"><section className="message-card results-card"><span className="turn-done">★</span><small>Partida terminada</small><h1>{mode === "teams" ? `${ranked[0]?.name} gana` : "Resultado final"}</h1><p>{mode === "teams" ? "Gana quien consigue más aciertos; en caso de empate, quien usa menos tiempo." : "Así terminó tu rosco."}</p><div className="team-results">{ranked.map((result, index) => <div className={index === 0 ? "winner" : ""} key={result.name}><span>{index === 0 && mode === "teams" ? "Ganador" : "Resultado"}</span><h2>{result.name}</h2><strong>{result.correct} <small>aciertos</small></strong><p>{clock(result.elapsed)} · {result.wrong} incorrectas</p></div>)}</div><div className="result-actions"><button className="secondary" onClick={() => setView("setup")}>Editar partida</button><button className="start-button" onClick={start}>Jugar de nuevo</button></div></section></main>;
  }

  return (
    <main className="game-page">
      <header className="mobile-header"><div><span>{mode === "teams" ? teamNames[teamIndex] : "Ronda individual"}</span><strong>{correct} aciertos</strong></div><div className="header-actions">{liveId && <button className="share-live" onClick={copyShareLink}>{shareCopied ? "✓ Copiado" : "Compartir en vivo"}</button>}<button onClick={exitGame}>Salir</button></div></header>
      <section className="rosco-area">
        <div className="rosco" aria-label="Rosco de letras">
          {words.map((word, index) => {
            const angle = (360 / words.length) * index - 90;
            return <button key={`${word.letter}-${index}`} aria-label={`Letra ${word.letter}, ${word.mark}`} className={`rosco-letter ${word.mark} ${index === current ? "current" : ""}`} style={{ "--angle": `${angle}deg` } as CSSProperties} onClick={() => (word.mark === "pending" || word.mark === "passed") && setCurrent(index)}>{word.letter}</button>;
          })}
          <div className={`timer-display ${remaining <= 10 ? "urgent" : ""}`}><small>Tiempo</small><strong>{clock(remaining)}</strong><button onClick={() => setRunning(!running)}>{running ? "Pausar" : "Continuar"}</button></div>
        </div>
      </section>

      <section className="clue-panel">
        <div className="current-label"><span>{active.relation === "EMPIEZA" ? "Empieza por" : "Contiene la"} {active.letter}</span><button onClick={() => setShowAnswer(!showAnswer)}>{showAnswer ? "Ocultar respuesta" : "Mostrar respuesta"}</button></div>
        <h1>{active.clue}</h1>
        <div className={`operator-answer ${showAnswer ? "" : "concealed"}`}><small>Respuesta del operador</small><strong>{showAnswer ? active.answer : "••••••••"}</strong></div>
        <div className="controls"><button className="wrong-control" onClick={() => setMark("wrong")}><b>×</b><span>Incorrecto</span></button><button className="pass-control" onClick={() => setMark("passed")}><b>↻</b><span>Pasapalabra</span></button><button className="correct-control" onClick={() => setMark("correct")}><b>✓</b><span>Correcto</span></button></div>
      </section>
    </main>
  );
}

function Header() { return <header className="brand"><div>P</div><p><strong>Pasapalabras</strong><span>Panel del operador</span></p></header>; }
