import '@fontsource/lilita-one';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import './styles.css';
import { App } from './app.ts';
import { initPwa } from './pwa.ts';
import { Home } from './ui/home.ts';

initPwa();
const app = new App();
// Canvas text needs the web fonts loaded before the first frame that uses them.
void document.fonts?.ready.then(() => {
  const home = new Home(app);
  const params = new URLSearchParams(location.search);
  if (params.has('demo')) home.flows.demo();
  const room = params.get('room')?.trim().toUpperCase();
  if (room && /^[A-Z]{4}$/.test(room)) {
    // Drop the code from the address bar so a reload doesn't rejoin an old room.
    params.delete('room');
    history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
    home.openInvite(room);
  }
  if (params.has('debug')) {
    void import('./audio/check.ts').then((m) => {
      (window as unknown as { __bm: unknown; __app: unknown; __home: unknown }).__bm = m;
      (window as unknown as { __app: unknown }).__app = app;
      (window as unknown as { __home: unknown }).__home = home;
    });
  }
});
