import {LitElement, html} from 'lit-element';
import {I18nMixin} from '../i18n.js';
import '../areaOfInterest/AreaOfInterestDrawer.js';
import '../layers/ngm-layers.js';
import '../layers/ngm-catalog.js';
import './ngm-gst-interaction.js';
import {LAYER_TYPES, DEFAULT_LAYER_OPACITY, defaultLayerTree} from '../constants.js';
import {getLayerParams, syncLayersParam, getAssetIds} from '../permalink.js';
import {createCesiumObject} from '../layers/helpers.js';
import i18next from 'i18next';
import 'fomantic-ui-css/components/accordion.js';
import $ from '../jquery.js';

const WELCOME_PANEL = 'welcome-panel';
const DRAW_TOOL_GST = 'draw-tool-gst';
const DRAW_TOOL_AOI = 'draw-tool-aoi';

class LeftSideBar extends I18nMixin(LitElement) {

  static get properties() {
    return {
      viewer: {type: Object},
      zoomTo: {type: Function},
      catalogLayers: {type: Object},
      activeLayers: {type: Object},
    };
  }

  render() {
    if (!this.viewer) {
      return '';
    }

    const hideWelcome = localStorage.getItem('hideWelcome') === 'true';
    return html`
      <div class="ui styled accordion" id="${WELCOME_PANEL}">
        <div class="title ${!hideWelcome ? 'active' : ''}">
          <i class="dropdown icon"></i>
          ${i18next.t('welcome_label')}
        </div>
        <div class="content ${!hideWelcome ? 'active' : ''}">
          <div>${i18next.t('welcome_text')}</div>
          <div class="ui tertiary center aligned segment">
            <i class="ui lightbulb icon"></i>
            ${i18next.t('welcome_instructions')}
          </div>
        </div>
      </div>

      <div class="ui styled accordion">
        <div class="title ngmlightgrey active">
          <i class="dropdown icon"></i>
          ${i18next.t('geocatalog_label')}
        </div>
        <div class="content ngm-layer-content active">
          <ngm-catalog
            .layers=${this.catalogLayers}
            @layerclick=${this.onCatalogLayerClicked}
            .viewer=${this.viewer}>
          </ngm-catalog>
        </div>
      </div>

      <div class="ui styled accordion">
        <div class="title ngmverylightgrey active">
          <i class="dropdown icon"></i>
          ${i18next.t('displayed_maps_label')}
        </div>
        <div class="content active">
          <ngm-layers
            @removeDisplayedLayer=${this.onRemoveDisplayedLayer}
            @layerChanged=${this.onLayerChanged}
            .layers=${this.activeLayers}
            .viewer=${this.viewer}
            @zoomTo=${evt => this.zoomTo(evt.detail)}>
          </ngm-layers>
        </div>
      </div>

      <div class="ui styled accordion" id="${DRAW_TOOL_AOI}">
        <div class="title ngmmidgrey">
          <i class="dropdown icon"></i>
          ${i18next.t('aoi_section_title')}
        </div>
        <div class="content">
          <ngm-aoi-drawer .viewer=${this.viewer}></ngm-aoi-drawer>
        </div>
      </div>

      <div class="ui styled accordion" id="${DRAW_TOOL_GST}">
        <div class="title ngmmidgrey">
          <i class="dropdown icon"></i>
          ${i18next.t('gst_accordion_title')}
        </div>
        <div class="content">
          <ngm-gst-interaction .viewer=${this.viewer}></ngm-gst-interaction>
          <div class="ui tertiary center aligned segment">
            ${i18next.t('gst_instructions')}
          </div>
        </div>
      </div>

      <div class="ui styled accordion">
        <div class="title ngmmidgrey">
          <i class="dropdown icon"></i>
          ${i18next.t('swissforages_accordion_title')}
        </div>
        <div class="content">
          <div class="ui link list">
            <a class="item" target="_blank" href="https://swissforages.ch/">
             <button class="ui icon button">
               <i class="pencil ruler icon"></i>
             </button>
             swissforages.ch
            </a>
          </div>
        </div>
      </div>
    `;
  }

  initializeActiveLayers() {
    const flatLayers = LeftSideBar.getFlatLayers(this.catalogLayers);

    const urlLayers = getLayerParams();
    const assetIds = getAssetIds();

    if (!urlLayers.length && !assetIds.length) {
      this.activeLayers = flatLayers.filter(l => l.displayed);
      syncLayersParam(this.activeLayers);
      return;
    }

    // First - make everything hidden
    flatLayers.forEach(l => {
      l.visible = false;
      l.displayed = false;
    });

    const activeLayers = [];
    urlLayers.forEach(urlLayer => {
      let layer = flatLayers.find(fl => fl.layer === urlLayer.name);
      if (!layer) {
        // Layers from the search are not present in the flat layers.
        layer = LeftSideBar.createSearchLayer(urlLayer.name, urlLayer.name);
      }
      layer.visible = urlLayer.visible;
      layer.opacity = urlLayer.opacity;
      layer.displayed = true;
      activeLayers.push(layer);
    });

    assetIds.forEach(assetId => {
      activeLayers.push({
        type: LAYER_TYPES.tiles3d,
        assetId: assetId,
        label: assetId,
        layer: assetId,
        visible: true,
        displayed: true,
        opacityDisabled: true,
        pickable: true
      });
    });

    this.activeLayers = activeLayers;
    syncLayersParam(this.activeLayers);
  }

  update(changedProperties) {
    if (!this.catalogLayers) {
      this.catalogLayers = [...defaultLayerTree];
      this.initializeActiveLayers();
    }
    super.update(changedProperties);
  }

  updated(changedProperties) {
    if (!this.accordionInited) {
      this.initBarAccordions();
    }

    super.updated(changedProperties);
  }

  async onCatalogLayerClicked(evt) {
    // toggle whether the layer is displayed or not (=listed in the side bar)
    const layer = evt.detail.layer;
    if (!layer.displayed) {
      await (layer.promise || (layer.promise = createCesiumObject(this.viewer, layer)));
      layer.add && layer.add();
      layer.visible = true;
      layer.displayed = true;
      this.activeLayers.push(layer);
    } else {
      if (!layer.visible) {
        layer.visible = true;
      } else {
        layer.displayed = false;
        layer.visible = false;
        layer.remove && layer.remove();
        const idx = this.activeLayers.findIdx(layer);
        this.activeLayers.splice(idx, 1);
      }
    }
    layer.setVisibility && layer.setVisibility(layer.visible);

    syncLayersParam(this.activeLayers);
    this.catalogLayers = [...this.catalogLayers];
    this.activeLayers = [...this.activeLayers];
  }

  onLayerChanged() {
    this.catalogLayers = [...this.catalogLayers];
  }

  onRemoveDisplayedLayer(evt) {
    const {config, idx} = evt.detail;
    this.activeLayers.splice(idx, 1);
    config.setVisibility(false);
    config.visible = false;
    config.displayed = false;
    if (config.remove) {
      config.remove();
    }
    this.viewer.scene.requestRender();
    syncLayersParam(this.activeLayers);
    this.catalogLayers = [...this.catalogLayers];
    this.activeLayers = [...this.activeLayers];
    this.requestUpdate();
  }

  static getFlatLayers(tree) {
    const flat = [];
    for (const layer of tree) {
      if (layer.children) {
        flat.push(...LeftSideBar.getFlatLayers(layer.children));
      } else {
        flat.push(layer);
      }
    }
    return flat;
  }


  // adds layer from search to 'Displayed Layers'
  addLayerFromSearch(searchLayer) {
    let layer;
    if (searchLayer.dataSourceName) {
      layer = this.activeLayers.find(l => l.type === searchLayer.dataSourceName); // check for layers like earthquakes
    } else {
      layer = this.activeLayers.find(l => l.layer === searchLayer.layer); // check for swisstopoWMTS layers
    }

    if (layer) { // for layers added before
      if (layer.type === LAYER_TYPES.swisstopoWMTS) {
        const index = this.activeLayers.indexOf(layer);
        this.activeLayers.splice(index, 1);
        layer.remove();
        layer.add(0);
        this.activeLayers.push(layer);
      }
      layer.setVisibility(true);
      layer.visible = true;
      layer.displayed = true;
      this.viewer.scene.requestRender();
    } else { // for new layers
      this.activeLayers.push(LeftSideBar.createSearchLayer(searchLayer.title, searchLayer.layer));
    }
    this.activeLayers = [...this.activeLayers];
    syncLayersParam(this.activeLayers);
    this.requestUpdate();
  }

  static createSearchLayer(title, layer) {
    return {
      type: LAYER_TYPES.swisstopoWMTS,
      label: title,
      layer: layer,
      visible: true,
      displayed: true,
      opacity: DEFAULT_LAYER_OPACITY
    };
  }

  accordionFactory(element) {
    switch (element.id) {
      case WELCOME_PANEL: {
        accordion(element, {
          onChange: () => {
            const newValue = !(localStorage.getItem('hideWelcome') === 'true');
            localStorage.setItem('hideWelcome', newValue);
          }
        });
        break;
      }
      case DRAW_TOOL_GST: {
        accordion(element, {
          onClosing: () => {
            const aoiElement = this.querySelector('ngm-aoi-drawer');
            aoiElement.setAreasClickable(true);
            const gstElement = this.querySelector('ngm-gst-interaction');
            gstElement.changeTool();
          },
          onOpening: () => {
            const aoiElement = this.querySelector('ngm-aoi-drawer');
            aoiElement.setAreasClickable(false);
            $(`#${DRAW_TOOL_AOI}`).accordion('close', 0);
          }
        });
        break;
      }
      case DRAW_TOOL_AOI: {
        accordion(element, {
          onClosing: () => {
            const aoiElement = this.querySelector('ngm-aoi-drawer');
            aoiElement.cancelDraw();
          },
          onOpening: () => $(`#${DRAW_TOOL_GST}`).accordion('close', 0)
        });
        break;
      }
      default:
        accordion(element);
    }
  }

  initBarAccordions() {
    const sideBarElement = document.querySelector('ngm-left-side-bar');

    for (let i = 0; i < sideBarElement.childElementCount; i++) {
      const element = sideBarElement.children.item(i);
      if (element.classList.contains('accordion')) {
        this.accordionFactory(element);
      }
    }

    this.accordionInited = true;
  }

  createRenderRoot() {
    return this;
  }
}

function accordion(element, options = {}) {
  return $(element).accordion(Object.assign({
    duration: 150
  }, options));
}


customElements.define('ngm-left-side-bar', LeftSideBar);
