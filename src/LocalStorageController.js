const LOCALSTORAGE_AOI_KEY = 'aoi';
const LOCALSTORAGE_WELCOME_KEY = 'hideWelcome';
const LOCALSTORAGE_SENTRY_KEY = 'sentryConfirmed';

export class LocalStorageController {
  constructor() {
    const aoiElement = document.querySelector('ngm-aoi-drawer');
    aoiElement.addStoredAreas(this.getStoredAoi());
    aoiElement.addEventListener('aoi_list_changed', evt => this.setAoiInStorage(evt.detail.entities));


    const sideBarElement = document.querySelector('ngm-left-side-bar');
    sideBarElement.hideWelcome = this.hideWelcomeValue;
    sideBarElement.addEventListener('welcome_panel_changed', this.updateWelcomePanelState);
  }

  get isSentryConfirmed() {
    return localStorage.getItem(LOCALSTORAGE_SENTRY_KEY) === 'true';
  }

  get hideWelcomeValue() {
    return localStorage.getItem(LOCALSTORAGE_WELCOME_KEY) === 'true';
  }

  saveSentryConfirmation() {
    localStorage.setItem(LOCALSTORAGE_SENTRY_KEY, 'true');
  }

  updateWelcomePanelState() {
    const newValue = !(localStorage.getItem(LOCALSTORAGE_WELCOME_KEY) === 'true');
    localStorage.setItem(LOCALSTORAGE_WELCOME_KEY, newValue);
  }

  getStoredAoi() {
    const storedAoi = localStorage.getItem(LOCALSTORAGE_AOI_KEY);
    if (storedAoi) {
      return JSON.parse(storedAoi);
    }
    return [];
  }

  setAoiInStorage(areas) {
    localStorage.setItem(LOCALSTORAGE_AOI_KEY, JSON.stringify(areas));
  }
}
