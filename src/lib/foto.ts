/**
 * Recorta a foto ao centro e reduz para 256×256 em JPEG. Fica com poucos KB,
 * o que chega para um avatar e cabe numa coluna de texto (ou no Storage).
 */
export function reduzirFoto(ficheiro: File, lado = 256): Promise<string> {
  return new Promise((resolver, rejeitar) => {
    const url = URL.createObjectURL(ficheiro);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = lado;
      canvas.height = lado;
      const menor = Math.min(img.width, img.height);
      canvas.getContext("2d")!.drawImage(img, (img.width - menor) / 2, (img.height - menor) / 2, menor, menor, 0, 0, lado, lado);
      URL.revokeObjectURL(url);
      resolver(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rejeitar(new Error("Não foi possível ler essa imagem. Escolha um JPG ou PNG."));
    };
    img.src = url;
  });
}
