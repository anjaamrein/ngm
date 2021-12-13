import {html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {repeat} from 'lit/directives/repeat.js';
import {LitElementI18n} from '../i18n.js';
import type {Config} from './ngm-layers-item';
// eslint-disable-next-line no-duplicate-imports
import './ngm-layers-item';

@customElement('ngm-layers')
export default class LayerTree extends LitElementI18n {
  @property({type: Array}) layers: Config[] = [];
  @property({type: Object}) actions: any;


  // changes layer position in 'Displayed Layers'
  moveLayer(config: Config, delta: number) {
    this.actions.moveLayer(this.layers, config, delta);
    this.dispatchEvent(new CustomEvent('layerChanged'));
    this.requestUpdate();
  }

  createLayerTemplate(config: Config, idx: number, len: number) {
    const upClassMap = {disabled: (idx === 0)};
    idx = len - 1 - idx; // we want to create in reverse order
    const downClassMap = {disabled: idx === 0};

    if (!config.promise) {
      config.promise = config.load();
    }

    const detail = {
      config,
      idx
    };

    return html`
      <ngm-layers-item
        .actions=${this.actions}
        .config=${config}
        label=${config.label}
        @removeDisplayedLayer=${() => this.dispatchEvent(new CustomEvent('removeDisplayedLayer', {detail}))}
        @zoomTo=${() => this.dispatchEvent(new CustomEvent('zoomTo', {detail: config}))}
        @layerChanged=${() => {
        this.dispatchEvent(new CustomEvent('layerChanged'));
        this.requestUpdate(); // force update to render visibility changes
      }}
        @moveLayer=${evt => this.moveLayer(config, evt.detail)}
        .upClassMap=${upClassMap}
        .downClassMap=${downClassMap}
      >
      </ngm-layers-item>
      <div class="ui divider"></div>
    `;
  }

  // builds ui structure of layertree and makes render
  render() {
    const len = this.layers ? this.layers.length : 0;
    const reverse = [...this.layers].reverse();
    return html`
      ${repeat(
      reverse,
      (config) => config.label,
      (config, idx) => this.createLayerTemplate(config, idx, len)
    )}
    `;
  }

  createRenderRoot() {
    return this;
  }
}
