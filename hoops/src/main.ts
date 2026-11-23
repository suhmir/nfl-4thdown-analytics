import Phaser from 'phaser';
import '@fontsource/teko/latin-500.css';
import '@fontsource/teko/latin-600.css';
import '@fontsource/teko/latin-700.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import './style.css';
import { VIEW } from './config';
import { GameScene } from './scenes/GameScene';
import { UI } from './ui/UI';

async function boot() {
  // Canvas text (court wordmarks, LED boards, popups) needs the fonts first.
  try {
    await Promise.all([
      document.fonts.load('600 40px Teko'),
      document.fonts.load('700 40px Teko'),
      document.fonts.load('italic 900 40px Teko'),
      document.fonts.load('600 20px "Barlow Condensed"'),
    ]);
  } catch { /* fall back to system fonts */ }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: VIEW.W,
    height: VIEW.H,
    backgroundColor: '#07080c',
    antialias: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.NO_CENTER },
    scene: [],
    banner: false,
    fps: { target: 60 },
  });

  game.events.once(Phaser.Core.Events.READY, () => {
    const ui = new UI(document.getElementById('ui')!, game);
    game.scene.add('Game', GameScene, true, { demo: true });
    (window as unknown as { __hoops: unknown }).__hoops = { game, ui };
    document.getElementById('loading')?.classList.add('done');
  });
}

void boot();
