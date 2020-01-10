import i18next from 'i18next';
import locI18next from 'loc-i18next';
import {html, render} from 'lit-html';

import {appError} from './utils.js';

const LANGS = ['de', 'fr', 'it', 'en', 'rm'];

function detectLanguage() {
  // detect language and initialize lang
  let languages = [];
  if (navigator.languages) {
    languages.push(...navigator.languages)
  }
  if (navigator.language) {
    languages.push(navigator.language);
  }

  for (let lang of languages) {
    lang = lang.substr(0, 2).toLowerCase(); // limit to first 2 characters
    if (LANGS.includes(lang)) {
      return lang;
    }
  }

  return 'en'; // fallback to English
}

export function init() {
  i18next.init({
    whitelist: LANGS,
    load: 'languageOnly',
    debug: true,
    resources: {
      en: {
        translation: {
          "disclaimer": "<a target='_blank' href='https://www.geo.admin.ch/en/about-swiss-geoportal/impressum.html#copyright'>Copyright & data protection</a>",
          "search_placeholder": "Search..."
        }
      },
      de: {
        translation: {
          "disclaimer": "<a target='_blank' href='https://www.geo.admin.ch/de/about-swiss-geoportal/impressum.html#copyright'>Copyright & Datenschutzerklärung</a>",
          "search_placeholder": "Suchen..."
        }
      },
      fr: {
        translation: {
          "disclaimer": "<a target='_blank' href='https://www.geo.admin.ch/fr/about-swiss-geoportal/impressum.html#copyright'>Conditions d'utilisation</a>",
          "search_placeholder": "Rechercher..."
        }
      },
      it: {
        translation: {
          "disclaimer": "<a target='_blank' href='https://www.geo.admin.ch/it/about-swiss-geoportal/impressum.html#copyright'>Copyright e dichiarazione della protezione dei diritti d'autore</a>",
          "search_placeholder": "Ricercare..."
        }
      },
      rm: {
        translation: {
          "disclaimer": "<a target='_blank' href='https://www.geo.admin.ch/rm/about-swiss-geoportal/impressum.html#copyright'>Copyright & decleraziun da protecziun da datas</a>",
          "search_placeholder": "Tschertgar..."
        }
      }
    }
  }, function(err, t) {
    const localize = locI18next.init(i18next);
    function setLanguage(lang) {
      i18next.changeLanguage(lang, (err, t) => {
        if (!err) {
          document.documentElement.lang = lang;
          localize("[data-i18n]");
        } else {
          appError('Could not change language');
        }
      });
    }
    const templates = LANGS.map(lang => {
      const onclick = evt => {
        setLanguage(lang);
        evt.preventDefault();
      };

      return html`
        <a class="item lang-${lang}" @click="${onclick}">${lang.toUpperCase()}</a>
      `;
    });
    render(templates, document.getElementById('langs'));

    const userLang = detectLanguage();
    setLanguage(userLang);
  });
}
