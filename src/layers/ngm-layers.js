import {html, LitElement} from 'lit-element';
import {I18nMixin} from '../i18n.js';

import './ngm-layers-item.js';

export default class LayerTree extends I18nMixin(LitElement) {

  constructor(){
    super();
    this.addEventListener('refresh', this.requestUpdate());
  }

  static get properties() {
    return {
      actions: {type: Object},
      layers: {type: Object},
    };
  }

  createRenderRoot() {
    return this;
  }

  // builds ui structure of layertree and makes render
  render() {
    const layerTemplates = this.layers.map((config, idx) => {
      if (!config.promise) {
        config.promise = config.load();
      }
      const downClassMap = {disabled: idx === 0};
      const upClassMap = {disabled: (idx === this.layers.length - 1)};
      const detail = {
        config,
        idx
      };
      return html`
      <ngm-layers-item
         .actions=${this.actions}
         .config=${config}
         @removeDisplayedLayer=${() => this.dispatchEvent(new CustomEvent('removeDisplayedLayer', {detail}))}
         @zoomTo=${() => this.dispatchEvent(new CustomEvent('zoomTo', {detail: config}))}
         @layerChanged=${() => {
           this.dispatchEvent(new CustomEvent('layerChanged'));
           this.requestUpdate(); // force update to render visiblity changes
         }}
         @moveLayer=${evt => this.moveLayer(config, evt.detail)}
         .upClassMap=${upClassMap}
         .downClassMap=${downClassMap}
        >
      </ngm-layers-item>`;
    });
    layerTemplates.reverse();

    return html`${layerTemplates}`;
  }

  // changes layer position in 'Displayed Layers'
  moveLayer(config, delta) {
    this.actions.moveLayer(this.layers, config, delta);
    this.requestUpdate();
  }
}

customElements.define('ngm-layers', LayerTree);
