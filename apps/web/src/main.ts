import '@fontsource/press-start-2p';
import './styles.css';
import { App } from './app.ts';
import { Title } from './game/title.ts';
import { preloadBeans } from './render/beans.ts';

preloadBeans();
const app = new App();
new Title(app);
