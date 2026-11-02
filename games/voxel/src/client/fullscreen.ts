/** Toggle the game's element, including when the browser exits via Escape. */
export async function toggleFullscreen(element: HTMLElement): Promise<void> {
  const document = element.ownerDocument;
  if (document.fullscreenElement === element) await document.exitFullscreen();
  else await element.requestFullscreen();
}
