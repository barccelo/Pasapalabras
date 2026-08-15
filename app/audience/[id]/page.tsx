"use client";

import { useEffect, useState, type CSSProperties } from "react";

type PublicWord = { letter: string; mark: "pending" | "passed" | "correct" | "wrong" };
type LiveState = { words: PublicWord[]; current: number; clue: string; relation: string; remaining: number; team: string; correct: number; running: boolean; closed?: boolean; hostOnline?: boolean };

function clock(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }

export default function Audience({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState("");
  const [title, setTitle] = useState("Pasapalabras");
  const [state, setState] = useState<LiveState | null>(null);

  useEffect(() => { params.then((value) => setId(value.id)); }, [params]);
  useEffect(() => {
    if (!id) return;
    let active = true;
    const load = async () => {
      const response = await fetch(`/api/live/${id}`, { cache: "no-store" });
      if (response.ok && active) { const data = await response.json() as { gameTitle: string; state: LiveState }; setTitle(data.gameTitle); setState(data.state); }
    };
    load(); const timer = window.setInterval(load, 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, [id]);

  if (!state) return <main className="audience-loading">Preparando el rosco…</main>;
  if (state.closed || state.hostOnline === false) return <main className="audience-loading">La partida fue cerrada por el anfitrión.</main>;
  return <main className="audience-page"><header><span>En vivo</span><h1>{title}</h1><p>{state.team} · {state.correct} aciertos</p></header><section className="audience-stage"><div className="audience-rosco">{state.words.map((word, index) => { const angle = (360 / state.words.length) * index - 90; return <div key={index} className={`audience-letter ${word.mark} ${index === state.current ? "current" : ""}`} style={{ "--angle": `${angle}deg` } as CSSProperties}>{word.letter}</div>; })}<div className={`audience-time ${state.remaining <= 10 ? "urgent" : ""}`}><small>Tiempo</small><strong>{clock(state.remaining)}</strong><span>{state.running ? "Jugando" : "En pausa"}</span></div></div><div className="audience-clue"><span>{state.relation}</span><h2>{state.clue}</h2></div></section><footer>Vista para audiencia · La respuesta permanece oculta</footer></main>;
}
