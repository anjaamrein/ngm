import {LitElement, html} from 'lit-element';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';
import Cartographic from 'cesium/Core/Cartographic.js';
import ScreenSpaceEventHandler from 'cesium/Core/ScreenSpaceEventHandler.js';
import ScreenSpaceEventType from 'cesium/Core/ScreenSpaceEventType.js';


class NgmFeatureHeight extends I18nMixin(LitElement) {

  static get properties() {
    return {
      viewer: {type: Object},
      height: {type: Number}
    };
  }

  constructor() {
    super();

    this.height = undefined;
    this.eventHandler = undefined;

    // always use the 'de-CH' locale to always have the simple tick as thousands separator
    this.integerFormat = new Intl.NumberFormat('de-CH', {
      maximumFractionDigits: 0
    });
  }

  updated() {
    if (this.viewer && !this.eventHandler) {
      this.eventHandler = new ScreenSpaceEventHandler(this.viewer.canvas);
      this.eventHandler.setInputAction(this.onMouseMove.bind(this), ScreenSpaceEventType.MOUSE_MOVE);
    }
  }

  disconnectedCallback() {
    if (this.eventHandler) {
      this.eventHandler.destroy();
      this.eventHandler = undefined;
    }
    super.disconnectedCallback();
  }

  onMouseMove(movement) {
    const feature = this.viewer.scene.pick(movement.endPosition);
    const cartesianPosition = this.viewer.scene.pickPosition(movement.endPosition);
    if (feature && cartesianPosition) {
      const position = Cartographic.fromCartesian(cartesianPosition);
      const altitude = this.viewer.scene.globe.getHeight(position);
      this.height = position.height - altitude;
    } else {
      this.height = undefined;
    }
  }

  render() {
    if (this.height !== undefined) {
      return html`
        ${i18next.t('Object height')}: ${this.integerFormat.format(this.height)} m
      `;
    } else {
      return html``;
    }
  }
}

customElements.define('ngm-feature-height', NgmFeatureHeight);
