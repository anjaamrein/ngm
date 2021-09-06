import '@geoblocks/ga-search';

import {getLayersConfig} from './swisstopoImagery.js';
import {escapeRegExp} from './utils.js';

import Rectangle from 'cesium/Source/Core/Rectangle';
import Cartographic from 'cesium/Source/Core/Cartographic';
import Math from 'cesium/Source/Core/Math';
import {extractEntitiesAttributes} from './query/objectInformation.js';

/**
 * @param {import('cesium/Source/Widgets/Viewer/Viewer').default} viewer
 * @param {HTMLElement} element
 * @param layerTree
 */
export function setupSearch(viewer, element, layerTree) {

  // search filter configuration
  getLayersConfig().then(layersConfig => {
    element.filterResults = result => {
      if (result.properties && result.properties.origin === 'layer') {
        const layerConfig = layersConfig[result.properties.layer];
        return !!layerConfig && (layerConfig.type === 'wmts' || layerConfig.type === 'wms');
      } else {
        return true;
      }
    };
  });

  // add icon before the label in the result list
  element.renderResult = (result, label) => {
    let iconName;
    if (result.properties) {
      // from geoadmin
      iconName = result.properties.origin === 'layer' ? 'layer group' : 'map pin';
    } else {
      // from cesium entities
      iconName = 'cube';
    }
    return `<i class="${iconName} grey icon"></i> ${label}`;
  };

  // location search result
  element.addEventListener('submit', event => {
    const result = event.detail.result;
    if (result.properties) {
      // from geoadmin
      const origin = result.properties.origin;
      const rectangle = Rectangle.fromDegrees(...result.bbox);
      if (origin === 'layer') {
        // add layer
        layerTree.addLayerFromSearch(result.properties);
      } else {
        // recenter to location
        if (rectangle.width < Math.EPSILON3 || rectangle.height < Math.EPSILON3) {
          // rectangle is too small
          const center = Rectangle.center(rectangle);
          center.height = 5000;
          viewer.camera.flyTo({
            destination: Cartographic.toCartesian(center)
          });
        } else {
          // rectangle
          viewer.camera.flyTo({
            destination: rectangle
          });
        }
      }
    } else {
      layerTree.addLayerFromSearch(result);
      viewer.zoomTo(result.entity);
    }
    event.target.autocomplete.input.blur();
  });

  // search primitives
  element.additionalSource = {
    search: input => {
      const matches = [];
      const regexp = new RegExp(escapeRegExp(input), 'i');
      const dataSources = viewer.dataSources;
      for (let i = 0, ii = dataSources.length; i < ii; i++) {
        const dataSource = dataSources.get(i);
        dataSource.entities.values.forEach(entity => {
          const attributes = extractEntitiesAttributes(entity);
          if (attributes && regexp.test(attributes.EventLocationName)) {
            matches.push({
              entity: entity,
              label: `${attributes.EventLocationName} (${attributes.Magnitude})`,
              dataSourceName: dataSource.name
            });
          }
        });
      }
      return Promise.resolve(matches);
    },
    getResultValue: result => result.label
  };

}
