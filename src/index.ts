import 'ec-ui';
import 'ec-ui/dist/index.css';
import mediumZoom from 'medium-zoom';
import { register } from 'swiper/element/bundle';
register();

document.addEventListener('DOMContentLoaded', () => {
  const zoom = mediumZoom('[data-zoomable]', {
    background: 'rgb(255, 255, 255)',
  });

  zoom.on('open', (event) => {
    (event.target as HTMLElement).style.height = 'auto';
    (event.target as HTMLElement).style.width = 'auto';
  });

  zoom.on('opened', (event) => {
    (event.target as HTMLElement).style.height = '';
    (event.target as HTMLElement).style.width = '';
  });
});
