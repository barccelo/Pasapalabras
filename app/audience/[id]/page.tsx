"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

type PublicWord = { letter: string; mark: "pending" | "passed" | "correct" | "wrong" };
type FinalWord = PublicWord & { answer: string; clue: string; relation: "EMPIEZA" | "CONTIENE" };
type FinalResult = { name: string; correct: number; wrong: number; elapsed: number; words: FinalWord[] };
type LiveState = { words?: PublicWord[]; current?: number; clue?: string; relation?: string; remaining?: number; timerMode?: "countdown" | "countup"; team?: string; correct?: number; running?: boolean; finished?: boolean; results?: FinalResult[]; closed?: boolean; hostOnline?: boolean };

function clock(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }

export default function Audience({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState("");
  const [title, setTitle] = useState("Pasapalabras");
  const [state, setState] = useState<LiveState | null>(null);
  const [displayTime, setDisplayTime] = useState(0);
  const [resultIndex, setResultIndex] = useState(0);
  const [selectedWord, setSelectedWord] = useState<number | null>(null);
  const lastUpdatedRef = useRef(0);

  useEffect(() => { params.then((value) => setId(value.id)); }, [params]);
  useEffect(() => {
    if (!id) return;
    lastUpdatedRef.current = 0;
    let active = true;
    let timer = 0;
    const load = async () => {
      const response = await fetch(`/api/live/${id}`, { cache: "no-store" });
      if (response.ok && active) {
        const data = await response.json() as { gameTitle: string; updatedAt: number; serverNow: number; state: LiveState };
        if (data.updatedAt < lastUpdatedRef.current) {
          timer = window.setTimeout(load, 2000);
          return;
        }
        const isFirstUpdate = lastUpdatedRef.current === 0;
        lastUpdatedRef.current = data.updatedAt;
        setTitle(data.gameTitle); setState(data.state);
        const base = data.state.remaining || 0;
        const elapsed = data.state.running ? Math.max(0, Math.floor((data.serverNow - data.updatedAt) / 1000)) : 0;
        const corrected = data.state.timerMode === "countup" ? base + elapsed : Math.max(0, base - elapsed);
        setDisplayTime((current) => {
          if (isFirstUpdate) return corrected;
          if (!data.state.running) return corrected;
          return data.state.timerMode === "countup" ? Math.max(current, corrected) : Math.min(current, corrected);
        });
        if (data.state.closed || data.state.hostOnline === false) return;
        timer = window.setTimeout(load, data.state.finished ? 10000 : 2000);
      }
    };
    void load();
    return () => { active = false; window.clearTimeout(timer); };
  }, [id]);

  useEffect(() => {
    if (!state?.running || state.finished || state.closed) return;
    const timer = window.setInterval(() => setDisplayTime((value) => state.timerMode === "countup" ? value + 1 : Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [state?.running, state?.finished, state?.closed, state?.timerMode]);

  if (!state) return <main className="audience-loading">Preparando el rosco…</main>;
  if (state.closed || state.hostOnline === false) return <main className="audience-loading">La partida fue cerrada por el anfitrión.</main>;
  if (state.finished && state.results?.length) {
    const result = state.results[resultIndex] || state.results[0];
    const word = selectedWord === null ? null : result.words[selectedWord];
    return <main className="audience-page audience-final"><header><span>Finalizado</span><h1>{title}</h1><p>{result.name} · {result.correct} aciertos · {clock(result.elapsed)}</p>{state.results.length > 1 && <div className="audience-result-tabs">{state.results.map((item, index) => <button className={index === resultIndex ? "selected" : ""} key={item.name} onClick={() => { setResultIndex(index); setSelectedWord(null); }}>{item.name}</button>)}</div>}</header><section className="audience-final-stage"><div className="audience-rosco final-rosco">{result.words.map((item, index) => { const angle = (360 / result.words.length) * index - 90; return <button key={index} className={`audience-letter ${item.mark} ${selectedWord === index ? "current" : ""}`} style={{ "--angle": `${angle}deg` } as CSSProperties} onClick={() => setSelectedWord(index)}>{item.letter}</button>; })}<div className="audience-time"><small>Resultado</small><strong>{result.correct}</strong><span>aciertos</span></div></div><div className={`audience-final-answer${word ? " visible" : ""}`}>{word ? <><span>{word.relation === "EMPIEZA" ? "Empieza por" : "Contiene la"} {word.letter}</span><h2>{word.clue}</h2><p>Respuesta <strong>{word.answer}</strong></p></> : <><span>Rosco final</span><h2>Toca una letra para ver su respuesta</h2><p>{result.wrong} incorrectas</p></>}</div></section><footer>Resultado final · Las respuestas ya están disponibles</footer></main>;
  }
  const liveWords = state.words || [];
  const liveTime = displayTime;
  return <main className="audience-page"><header><span>En vivo</span><h1>{title}</h1><p>{state.team} · {state.correct} aciertos</p></header><section className="audience-stage"><div className="audience-rosco">{liveWords.map((word, index) => { const angle = (360 / liveWords.length) * index - 90; return <div key={index} className={`audience-letter ${word.mark} ${index === state.current ? "current" : ""}`} style={{ "--angle": `${angle}deg` } as CSSProperties}>{word.letter}</div>; })}<div className={`audience-time ${state.timerMode !== "countup" && liveTime <= 10 ? "urgent" : ""}`}><small>{state.timerMode === "countup" ? "Transcurrido" : "Tiempo"}</small><strong>{clock(liveTime)}</strong><span>{state.running ? "Jugando" : "En pausa"}</span></div></div><div className="audience-clue"><span>{state.relation}</span><h2>{state.clue}</h2></div></section><footer>Vista para audiencia · La respuesta permanece oculta</footer></main>;
}
