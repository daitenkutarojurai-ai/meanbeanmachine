import '@fontsource/lilita-one';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import './styles.css';
import { App } from './app.ts';
import { Home } from './ui/home.ts';

const app = new App();
// Canvas text needs the web fonts loaded before the first frame that uses them.
void document.fonts?.ready.then(() => {
  const home = new Home(app);
  const params = new URLSearchParams(location.search);
  if (params.has('demo')) home.flows.demo();
  if (params.has('debug')) {
    void import('./audio/check.ts').then((m) => {
      (window as unknown as { __bm: unknown; __app: unknown; __home: unknown }).__bm = m;
      (window as unknown as { __app: unknown }).__app = app;
      (window as unknown as { __home: unknown }).__home = home;
    });
  }
});
