import {LitElement, html} from 'lit-element';
import '@geoblocks/cesium-compass';
import './cesium-view-cube.js';
import './cesium-minimap.js';
import './ngm-zoom-buttons.js';
import './ngm-elevator-buttons.js';
import './ngm-keyboard-info-popup.js';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';

class NgmNavigationWidgets extends I18nMixin(LitElement) {

  static get properties() {
    return {
      viewer: {type: Object}
    };
  }

  render() {
    if (this.viewer) {
      return html`
        <div id="compass-info-popup"></div>
        <cesium-view-cube .scene="${this.viewer.scene}"></cesium-view-cube>
        <cesium-compass .scene="${this.viewer.scene}" .clock="${this.viewer.clock}"
        data-tooltip=${i18next.t('cesium_compass_tooltip')}
        data-position="left center"
        data-variation="mini"
        ></cesium-compass>
        <ngm-zoom-buttons .scene="${this.viewer.scene}"></ngm-zoom-buttons>
        <ngm-elevator-buttons .scene="${this.viewer.scene}"></ngm-elevator-buttons>
        <ngm-keyboard-info-popup></ngm-keyboard-info-popup>
        <cesium-minimap .scene="${this.viewer.scene}" extent="[4.838149149, 43.343659149, 11.779662851, 50.285172851]">
          <i slot="marker" class="video icon"></i>
          <img slot="image" src="src/images/overview.svg">
        </cesium-minimap>
      `;
    } else {
      return html``;
    }
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-navigation-widgets', NgmNavigationWidgets);
