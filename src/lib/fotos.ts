// Fotografias provisórias, de bancos com licença gratuita para uso comercial
// (Unsplash License e Pexels License). Trocar pelas fotos reais da equipa e
// da clínica antes de publicar a sério — basta mudar os endereços aqui.

const unsplash = (id: string, largura: number) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${largura}&q=70`;
const pexels = (id: number, largura: number) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${largura}`;

export const FOTOS = {
  /** Fundo da abertura: corredor de hospital. */
  abertura: unsplash("photo-1516841273335-e39b37888115", 1800),
  /** A equipa por baixo da abertura (fundo branco, para se fundir com a página). */
  equipa: [pexels(5234504, 560), pexels(12793736, 640), pexels(18252404, 560)],
  /** Fundo das especialidades: bloco operatório. */
  especialidades: unsplash("photo-1579684385127-1ef15d508118", 1800),
  /** Fecho da página: equipa de máscara. */
  fecho: pexels(5452196, 1600),
  /** Painel do ecrã de entrada. */
  entrar: pexels(6129494, 1200),
};

export const CREDITOS_FOTOS = [
  "Abertura: Unsplash, photo-1516841273335",
  "Especialidades: Unsplash, photo-1579684385127",
  "Equipa: Pexels 5234504, 12793736 e 18252404",
  "Fecho: Pexels 5452196",
  "Entrar: Pexels 6129494",
];
