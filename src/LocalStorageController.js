const LOCALSTORAGE_AOI_KEY = 'aoi';
const LOCALSTORAGE_WELCOME_KEY = 'hideWelcome';
const LOCALSTORAGE_REVIEW_KEY = 'hideReviewWindow';
const LOCALSTORAGE_CATALOG_KEY = 'hideCatalogWindow';

export class LocalStorageController {
  get hideWelcomeValue() {
    return localStorage.getItem(LOCALSTORAGE_WELCOME_KEY) === 'true';
  }

  get hideReviewWindowValue() {
    return localStorage.getItem(LOCALSTORAGE_REVIEW_KEY) === 'true';
  }

  get hideCatalogValue() {
    return localStorage.getItem(LOCALSTORAGE_CATALOG_KEY) === 'true';
  }

  updateWelcomePanelState() {
    const newValue = localStorage.getItem(LOCALSTORAGE_WELCOME_KEY) !== 'true';
    localStorage.setItem(LOCALSTORAGE_WELCOME_KEY, newValue);
  }

  toggleCatalogState() {
    const newValue = localStorage.getItem(LOCALSTORAGE_CATALOG_KEY) !== 'true';
    localStorage.setItem(LOCALSTORAGE_CATALOG_KEY, newValue);
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

  updateReviewWindowState() {
    const newValue = localStorage.getItem(LOCALSTORAGE_REVIEW_KEY) !== 'true';
    localStorage.setItem(LOCALSTORAGE_REVIEW_KEY, newValue);
  }
}
