// Browser entry. With no parameters it opens the deck builder; `?play` starts a live match against the
// bot, and `?replay=` or `?tick=` go straight to the match view too (see play.ts).
import { icon } from './art/ui.ts';
import { setFavicon } from './pixel-dom.ts';

setFavicon(icon('crown', 16));
const params = new URLSearchParams(window.location.search);
if (params.has('gallery')) {
  await import('./gallery.ts');
} else if (params.has('play') || params.has('replay') || params.has('tick')) {
  await import('./play.ts');
} else {
  const { showMenu } = await import('./menu.ts');
  showMenu();
}
