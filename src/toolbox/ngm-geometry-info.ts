import {LitElementI18n} from '../i18n';
import {customElement, state} from 'lit/decorators.js';
import {html} from 'lit';
import draggable from '../elements/draggable';
import {Entity, Viewer} from 'cesium';
import MainStore from '../store/main';
import CustomDataSource from 'cesium/Source/DataSources/CustomDataSource';
import {AOI_DATASOURCE_NAME} from '../constants';
import ToolboxStore from '../store/toolbox';
import i18next from 'i18next';
import {getValueOrUndefined} from '../cesiumutils';
import {NgmGeometry} from './interfaces';
import {classMap} from 'lit-html/directives/class-map.js';
import {downloadGeometry, updateEntityVolume} from './helpers';
import './ngm-geometry-edit';

@customElement('ngm-geometry-info')
export class NgmGeometryInfo extends LitElementI18n {
  @state() geomEntity: Entity | undefined;
  @state() editing = false;
  private viewer: Viewer | null = null;
  private geometriesDataSource: CustomDataSource | undefined;
  private geometry: NgmGeometry | undefined;

  constructor() {
    super();
    MainStore.viewer.subscribe(viewer => this.viewer = viewer);
    ToolboxStore.openedGeometryOptions.subscribe(options => {
      if (this.viewer && !this.geometriesDataSource)
        this.geometriesDataSource = this.viewer.dataSources.getByName(AOI_DATASOURCE_NAME)[0];
      if (!options?.id) {
        this.geomEntity = undefined;
        return;
      }
      const entity = this.geometriesDataSource?.entities.getById(options.id);
      if (!entity) return;
      this.geomEntity = entity;
      this.editing = !!options.editing;
    });
    ToolboxStore.sliceGeometry.subscribe(() => this.requestUpdate());
  }

  connectedCallback() {
    draggable(this, {
      allowFrom: '.drag-handle'
    });
    super.connectedCallback();
  }

  toggleGeomVolume(geom: NgmGeometry) {
    if (geom.volumeShowed) {
      this.hideVolume(geom.id);
    } else {
      const entity = this.geometriesDataSource?.entities.getById(geom.id!);
      if (!entity) return;
      updateEntityVolume(entity, this.viewer!.scene.globe);
    }
    this.requestUpdate();
  }

  hideVolume(id) {
    const entity = this.geometriesDataSource!.entities.getById(id);
    if (!entity) return;
    if (entity.billboard) {
      entity.ellipse!.show = <any>false;
    } else {
      if (entity.polyline) {
        entity.polyline!.show = <any>true;
      } else {
        entity.polygon!.show = <any>true;
      }
      entity.polylineVolume!.show = <any>false;
    }
    entity.properties!.volumeShowed = <any>false;
  }


  get infoTemplate() {
    const geom: NgmGeometry | undefined = this.geometry;
    if (!geom) return;
    return html`
      <div>
        <button class="ui button ngm-download-obj-btn ngm-action-btn"
                @click=${() => downloadGeometry(this.geometriesDataSource?.entities.getById(geom.id!))}>
          ${i18next.t('tbx_download_btn_label')}
          <div class="ngm-download-icon"></div>
        </button>
        <button @click="${() => {
        }}" class="ui button ngm-zoom-obj-btn ngm-action-btn">
          ${i18next.t('obj_info_zoom_to_object_btn_label')}
          <div class="ngm-zoom-plus-icon"></div>
        </button>
      </div>
      <div class="ngm-divider"></div>
      <div class="ngm-geom-info-content">
        <div class="ngm-geom-description">
          <div class="ngm-geom-info-label">${i18next.t('obj_info_description_label')}</div>
          <div class="ngm-geom-info-value">${geom.description || ''}</div>
        </div>
        <div class="ngm-geom-img">
          <div class="ngm-geom-info-label">${i18next.t('obj_info_image_label')}</div>
          <div ?hidden=${!geom.image} class="ngm-geom-info-value"><img src="${geom.image}" alt="${geom.image}"></div>
        </div>
        <div ?hidden=${!geom.volumeShowed} class="ngm-geom-limits">
          <div>
            <div class="ngm-geom-info-label">${i18next.t('tbx_volume_lower_limit_label')}</div>
            <div class="ngm-geom-info-value">${geom.volumeHeightLimits?.lowerLimit.toFixed() || ''}</div>
          </div>
          <div>
            <div class="ngm-geom-info-label">${i18next.t('tbx_volume_height_label')}</div>
            <div class="ngm-geom-info-value">${geom.volumeHeightLimits?.height.toFixed() || ''}</div>
          </div>
        </div>
        <div ?hidden=${geom.type === 'point' || geom.type === 'line'}>
          <div class="ngm-geom-info-label">${i18next.t('obj_info_area_label')}</div>
          <div class="ngm-geom-info-value">${geom.area || ''}</div>
        </div>
        <div ?hidden=${geom.type === 'point'}>
          <div class="ngm-geom-info-label">
            ${i18next.t(geom.type === 'line' ? 'obj_info_length_label' : 'obj_info_perimeter_label')}
          </div>
          <div class="ngm-geom-info-value">${geom.perimeter || ''}</div>
        </div>
        <div ?hidden=${geom.type === 'point'}>
          <div class="ngm-geom-info-label">${i18next.t('obj_info_number_segments_label')}</div>
          <div class="ngm-geom-info-value">${geom.numberOfSegments || ''}</div>
        </div>
      </div>
    `;
  }

  get editTemplate() {
    return html`<ngm-geometry-edit .entity=${this.geomEntity}></ngm-geometry-edit>`;
  }

  render() {
    this.hidden = !this.geomEntity;
    if (!this.geomEntity) return '';
    this.geometry = ToolboxStore.openedGeometry;
    return html`
      <div class="ngm-floating-window-header drag-handle">
        ${`${i18next.t('tbx_geometry')} ${getValueOrUndefined(this.geomEntity.properties!.type)}`}
        <div class="ngm-close-icon" @click=${() => ToolboxStore.setOpenedGeometryOptions(null)}></div>
      </div>
      <div class="ngm-geom-info-body">
        ${`${this.geomEntity.name}`}
        <div class="ngm-geom-actions">
          <div
            class="ngm-slicing-icon ${classMap({active: ToolboxStore.geomSliceActive})}"
            @click=${() => ToolboxStore.setSliceGeometry(this.geometry)}></div>
          <div class="ngm-extrusion-icon ${classMap({active: !!this.geometry?.volumeShowed})}"
               @click=${() => this.toggleGeomVolume(this.geometry!)}></div>
          <div class="ngm-edit-icon ${classMap({active: this.editing})}"
               @click=${() => this.editing = !this.editing}>
          </div>
        </div>
        <div class="ngm-divider"></div>
        ${this.editing ? this.editTemplate : this.infoTemplate}
      </div>
      <div class="ngm-drag-area drag-handle">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }
}
