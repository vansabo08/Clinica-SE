// O som das notificações: duas notas curtas, geradas com Web Audio (não há
// ficheiro para descarregar). Os navegadores só deixam tocar som depois de a
// pessoa tocar na página, por isso o áudio acorda no primeiro toque ou tecla.

const CHAVE = "cse-som";
const GESTOS = ["pointerdown", "keydown", "touchend"] as const;

let contexto: AudioContext | null = null;

function obterContexto(): AudioContext | null {
  if (contexto) return contexto;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    contexto = new AC();
  } catch {
    return null;
  }
  return contexto;
}

export function somLigado(): boolean {
  try {
    return localStorage.getItem(CHAVE) !== "desligado";
  } catch {
    return true;
  }
}

export function definirSom(ligado: boolean) {
  try {
    localStorage.setItem(CHAVE, ligado ? "ligado" : "desligado");
  } catch {
    // Sem armazenamento: fica ligado só nesta visita.
  }
}

let preparado = false;

/** Fica à espera do primeiro gesto para desbloquear o áudio. */
export function prepararSom() {
  if (preparado || typeof window === "undefined") return;
  preparado = true;
  const parar = () => GESTOS.forEach((g) => window.removeEventListener(g, acordar, true));
  function acordar() {
    const c = obterContexto();
    if (!c) return parar();
    c.resume().then(
      () => c.state === "running" && parar(),
      () => undefined,
    );
  }
  GESTOS.forEach((g) => window.addEventListener(g, acordar, true));
}

/** "Ding" de duas notas. Com `forcar`, toca mesmo com o som desligado (para experimentar). */
export function tocarNotificacao(forcar = false) {
  if (!forcar && !somLigado()) return;
  const c = obterContexto();
  if (!c) return;
  if (c.state !== "running") c.resume().catch(() => undefined);

  const t0 = c.currentTime + 0.02;
  const saida = c.createGain();
  saida.gain.value = 0.32;
  saida.connect(c.destination);

  const nota = (freq: number, inicio: number, duracao: number) => {
    // Fundamental mais dois harmónicos suaves: soa a sino pequeno, não a apito.
    for (const [mult, vol] of [
      [1, 1],
      [2, 0.22],
      [3, 0.06],
    ] as const) {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = "sine";
      osc.frequency.value = freq * mult;
      g.gain.setValueAtTime(0.0001, inicio);
      g.gain.exponentialRampToValueAtTime(vol, inicio + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, inicio + duracao);
      osc.connect(g).connect(saida);
      osc.start(inicio);
      osc.stop(inicio + duracao + 0.05);
    }
  };
  nota(880, t0, 0.55);
  nota(1318.5, t0 + 0.13, 0.9);

  try {
    navigator.vibrate?.([60, 40, 60]);
  } catch {
    // Sem vibração neste dispositivo.
  }
}
