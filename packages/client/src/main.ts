// Browser entry. With no parameters it opens the deck builder; `?play` starts a live match against the
// bot, and `?replay=` or `?tick=` go straight to the match view too (see play.ts).
const params = new URLSearchParams(window.location.search);
if (params.has('play') || params.has('replay') || params.has('tick')) {
  await import('./play.ts');
} else {
  const { showMenu } = await import('./menu.ts');
  showMenu();
}
