import {SWITZERLAND_RECTANGLE} from './constants.js';

import UrlTemplateImageryProvider from 'cesium/Scene/UrlTemplateImageryProvider.js';
import ImageryLayer from 'cesium/Scene/ImageryLayer.js';
import Credit from 'cesium/Core/Credit.js';

const layerUrlTemplate = 'https://wmts.geo.admin.ch/1.0.0/{layer}/default/{timestamp}/3857/{z}/{x}/{y}.{format}';

/**
 * @param {sring} layer Layer identifier
 * @param {import('cesium/Core/Rectangle').default} [rectangle]
 * @return {Promise<ImageryLayer>}
 */
export function getSwisstopoImagery(layer, rectangle = SWITZERLAND_RECTANGLE) {
  return new Promise((resolve, reject) => {
    getLayersConfig().then(layersConfig => {
      const config = layersConfig[layer];
      if (config) {
        if (config.type === 'wmts') {
          const url = layerUrlTemplate
            .replace('{layer}', config.serverLayerName)
            .replace('{timestamp}', config.timestamps[0])
            .replace('{format}',config.format);

          const imageryProvider = new UrlTemplateImageryProvider({
            url: url,
            rectangle: rectangle,
            credit: new Credit(config.attribution)
          });
          const imageryLayer = new ImageryLayer(imageryProvider, {
            alpha: config.opacity
          });

          resolve(imageryLayer);
        } else {
          reject('unsupported layer type');
        }
      } else {
        reject('layer not found');
      }
    });
  });
}

/**
 * @param {import('cesium/Scene/ImageryLayerCollection').default} collection
 * @param {import('cesium/Scene/ImageryLayer').default} imageryLayer
 * @return {boolean}
 */
export function containsSwisstopoImagery(collection, imageryLayer) {
  const url = imageryLayer.imageryProvider.url;
  for (let i = 0, ii = collection.length; i < ii; i++) {
    const layer = collection.get(i);
    if (layer.imageryProvider.url === url) {
      return true;
    }
  }
  return false;
}


let layersConfigPromise;

/**
 * @return {Promise<Object>}
 */
export function getLayersConfig() {
  if (!layersConfigPromise) {
    layersConfigPromise = fetch('https://map.geo.admin.ch/configs/en/layersConfig.json')
      .then(response => response.json());
  }
  return layersConfigPromise;
}
