import {readPodcasts} from './podcasts.mjs';
const {series,episodes}=readPodcasts();console.log(`${series.length} serie(s) y ${episodes.length} episodio(s) validados.`);
