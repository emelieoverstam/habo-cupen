// Skalar ner en bild i webbläsaren innan uppladdning, så att
// mobilfoton inte fyller lagringen eller segar ner sidan.

export async function resizeImage(file: File, maxSize = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('Kunde inte behandla bilden')),
      'image/jpeg',
      0.85
    )
  )
}
