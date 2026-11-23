import '@fontsource/press-start-2p';
import './styles.css';
import { App } from './app.ts';
import { Title } from './game/title.ts';
import { preloadBeans } from './render/beans.ts';

preloadBeans();
const app = new App();
new Title(app);

if (new URLSearchParams(location.search).has('debug')) {
  void import('./audio/check.ts').then((m) => {
    (window as unknown as { __bm: unknown; __app: unknown }).__bm = m;
    (window as unknown as { __app: unknown }).__app = app;
  });
}
