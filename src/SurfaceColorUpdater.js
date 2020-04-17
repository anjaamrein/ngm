import {ABOVE_SURFACE_CONFIGURATION, BELOW_SURFACE_CONFIGURATION} from './constants';

export default class SurfaceColorUpdater {
  /**
   * @param {import('cesium/Scene/Scene').default} scene
   */
  constructor(scene) {
    this.scene_ = scene;
    this.belowSurface = false;
    this.layersCount_ = 0;
    const checkPosition = this.checkPosition_.bind(this);
    this.scene_.postRender.addEventListener(checkPosition);
  }

  checkPosition_() {
    // FIXME: use 'cameraUnderground' instead of '_cameraUnderground' (https://github.com/CesiumGS/cesium/pull/8765)
    const belowSurface = this.scene_._cameraUnderground;

    const currentLayersCount = this.scene_.imageryLayers.length;
    const layersCountChanged = currentLayersCount !== this.layersCount_;

    if (belowSurface && (!this.belowSurface || layersCountChanged)) {
      this.updateLayers_(BELOW_SURFACE_CONFIGURATION);
      this.belowSurface = true;
      this.layersCount_ = currentLayersCount;
    } else if (!belowSurface && (this.belowSurface || layersCountChanged)) {
      this.updateLayers_(ABOVE_SURFACE_CONFIGURATION);
      this.belowSurface = false;
      this.layersCount_ = currentLayersCount;
    }
  }

  updateLayers_(configuration) {
    for (let i = 0; i < this.scene_.imageryLayers.length; i++) {
      const layer = this.scene_.imageryLayers.get(i);
      Object.keys(configuration).forEach(key => layer[key] = configuration[key]);
    }
  }
}
