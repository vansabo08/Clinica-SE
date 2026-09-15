// Mapa. Hoje: OpenStreetMap embutido (sem chave) e ligação de direcções do
// Google Maps, que abre a aplicação de mapas no telemóvel. Para trocar por
// um mapa interactivo (Mapbox, Google Maps JS), basta mudar estas funções.

export function urlMapaEmbutido(latitude: number, longitude: number, zoom = 0.008) {
  const bbox = [longitude - zoom, latitude - zoom * 0.6, longitude + zoom, latitude + zoom * 0.6].map((n) => n.toFixed(5)).join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}

export function linkComoChegar(latitude: number, longitude: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}
