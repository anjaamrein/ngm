import Cartesian2 from 'cesium/Source/Core/Cartesian2';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import Cartographic from 'cesium/Source/Core/Cartographic';
import CMath from 'cesium/Source/Core/Math';
import Matrix4 from 'cesium/Source/Core/Matrix4';
import PolygonPipeline from 'cesium/Source/Core/PolygonPipeline';
import Transforms from 'cesium/Source/Core/Transforms';
import SceneTransforms from 'cesium/Source/Scene/SceneTransforms';
import {degreesToLv95} from './projection';


export async function readTextFile(url) {
  const response = await fetch(url);
  try {
    return await response.text();
  } catch (e) {
    console.warn(e);
  }
}

/**
 * @param {import('cesium/Source/Scene/Camera').default} camera
 * @param {number} height Camera height in meters.
 */
export function setCameraHeight(camera, height) {
  const pc = camera.positionCartographic;
  camera.position = Cartesian3.fromRadians(pc.longitude, pc.latitude, height);
}

/**
 * @param {import('cesium/Source/Scene/Scene').default} scene
 * @param {boolean} useCamera
 * @param {function(import('cesium/Source/Scene/Camera').default): any} func
 */
export function aroundCenter(scene, useCamera, func) {
  const camera = scene.camera;
  const center = useCamera ? camera.positionWC : pickCenter(scene);
  console.assert(center !== undefined);
  const transform = Transforms.eastNorthUpToFixedFrame(center);
  const oldTransform = Matrix4.clone(camera.transform);
  camera.lookAtTransform(transform);
  func(camera);
  camera.lookAtTransform(oldTransform);
}

/**
 * @param {import('cesium/Source/Scene/Scene').default} scene
 * @return {Cartesian3}
 */
export function pickCenter(scene) {
  const camera = scene.camera;
  const windowPosition = new Cartesian2(
    scene.canvas.clientWidth / 2,
    scene.canvas.clientHeight / 2
  );
  const ray = camera.getPickRay(windowPosition);
  const center = scene.globe.pick(ray, scene);
  return center !== undefined ? center : camera.positionWC;
}

/**
 * @param {import('cesium/Source/Scene/Scene').default} scene
 * @return {Cartesian3 | undefined}
 */
export function pickCenterOnEllipsoid(scene) {
  const camera = scene.camera;
  const windowPosition = new Cartesian2(
    scene.canvas.clientWidth / 2,
    scene.canvas.clientHeight / 2
  );
  return camera.pickEllipsoid(windowPosition);
}

/**
 * @return {URLSearchParams}
 */
export function getURLSearchParams() {
  return new URLSearchParams(location.search);
}

/**
 * @param {URLSearchParams} params
 */
export function setURLSearchParams(params) {
  window.history.replaceState({}, '', `${location.pathname}?${params}`);
}

/**
 * @param {string} id
 */
export function clickOnElement(id) {
  document.getElementById(id).click();
}

/**
 * Change element position in array
 * @param {Array} array target array
 * @param {number} fromIdx from index
 * @param {number} toIdx to index
 * @return {Array}
 */
export function insertAndShift(array, fromIdx, toIdx) {
  const cutOut = array.splice(fromIdx, 1)[0];
  array.splice(toIdx, 0, cutOut);
  return array;
}

/**
 * @param {import('cesium/Source/Scene/Camera').default} camera
 * @param {number} angle
 */
export function verticalDirectionRotate(camera, angle) {
  const position = Cartesian3.normalize(camera.position, new Cartesian3());
  const up = Cartesian3.normalize(camera.up, new Cartesian3());

  const pitch = CMath.toDegrees(camera.pitch);
  if (pitch < -90 || pitch > 0) {
    angle = -angle;
  }

  const tangent = Cartesian3.cross(up, position, new Cartesian3());
  camera.rotate(tangent, angle);
}

/**
 * @param {string} string
 * @return {string}
 */
export function escapeRegExp(string) {
  return string ? string.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&') : string;
}

/**
 * @param {Array<Cartesian3>} positions
 * @param {Array<number>} [holes]
 * @return {number}
 */
function getPolygonArea(positions, holes = []) {
  const indices = PolygonPipeline.triangulate(positions, holes);
  let area = 0;

  for (let i = 0; i < indices.length; i += 3) {
    const vector1 = positions[indices[i]];
    const vector2 = positions[indices[i + 1]];
    const vector3 = positions[indices[i + 2]];
    //triangle sides
    const a = Cartesian3.distance(vector3, vector2);
    const b = Cartesian3.distance(vector1, vector3);
    const c = Cartesian3.distance(vector1, vector2);
    const p = (a + b + c) / 2;
    const triangleArea = Math.sqrt((p - a) * (p - b) * (p - c) * p);

    area += triangleArea;
  }
  return area * Math.pow(10, -6);
}

/**
 * Returns measurements for geometry
 * @param {Array<Cartesian3>} positions
 * @param {Array<number>} distances
 * @param {import('./draw/CesiumDraw').ShapeType} type
 */
export function getMeasurements(positions, distances, type) {
  const result = {
    segmentsNumber: positions.length
  };
  let perimeter = distances.reduce((a, b) => a + b, 0);
  if (type === 'rectangle') {
    perimeter *= 2;
    result.sidesLength = [distances[0], distances[1]];
  }
  result.perimeter = perimeter.toFixed(3);
  if (type === 'rectangle' || (type === 'polygon' && positions.length > 2)) {
    result.area = getPolygonArea(positions).toFixed(3);
  }
  return result;
}

/**
 * Returns window position of point on map
 * @param {import('cesium/Source/Scene/Scene.js').default} scene
 * @param {Cartographic} cartographicPosition
 * @return {Cartesian2}
 */
export function convertCartographicToScreenCoordinates(scene, cartographicPosition) {
  const lon = CMath.toDegrees(cartographicPosition.longitude);
  const lat = CMath.toDegrees(cartographicPosition.latitude);
  return SceneTransforms.wgs84ToWindowCoordinates(scene, Cartesian3.fromDegrees(lon, lat, cartographicPosition.height));
}

/**
 * Returns x,y in lv95 or wsg84 and height relative to ground
 * @param {import('cesium/Source/Scene/Scene.js').default} scene
 * @param {Cartographic} position
 * @param {'lv95' | 'wsg84'} coordinatesType
 * @return {{x: number, y: number, height: number}}
 */
export function prepareCoordinatesForUi(scene, position, coordinatesType) {
  let x, y;
  const lon = CMath.toDegrees(position.longitude);
  const lat = CMath.toDegrees(position.latitude);
  if (coordinatesType === 'lv95') {
    const coords = degreesToLv95([lon, lat]);
    x = Math.round(coords[0]);
    y = Math.round(coords[1]);
  } else {
    x = Number(lon.toFixed(6));
    y = Number(lat.toFixed(6));
  }
  let altitude = scene.globe.getHeight(position);
  altitude = altitude ? altitude : 0;
  const height = Math.round(position.height - altitude);
  return {x, y, height};
}

/**
 * Sets height in meters for each cartesian3 position in array
 * @param {import('cesium/Source/Scene/Scene.js').default} scene
 * @param {Array<Cartesian3>} positions
 * @param {number} height
 * @return {Array<Cartesian3>}
 */
export function updateHeightForCartesianPositions(scene, positions, height) {
  return positions.map(p => {
    const cartographicPosition = Cartographic.fromCartesian(p);
    const altitude = scene.globe.getHeight(cartographicPosition) || 0;
    cartographicPosition.height = height + altitude;
    return Cartographic.toCartesian(cartographicPosition);
  });
}

/**
 * Applies min/max values and returns value
 * @param {number} value
 * @param {number} minValue
 * @param {number} maxValue
 * @return {number}
 */
export function applyLimits(value, minValue, maxValue) {
  if (value < minValue || value > maxValue) {
    value = Math.max(value, minValue);
    value = Math.min(value, maxValue);
  }
  return value;
}

/**
 * Returns point of lines intersection or null
 * @param {Cartesian2} start1
 * @param {Cartesian2} end1
 * @param {Cartesian2} start2
 * @param {Cartesian2} end2
 * @return {Cartesian2|null}
 */
export function getLinesIntersection(start1, end1, start2, end2) {
  const delta1x = end1.x - start1.x;
  const delta1y = end1.y - start1.y;
  const delta2x = end2.x - start2.x;
  const delta2y = end2.y - start2.y;

  const determinant = delta1x * delta2y - delta2x * delta1y;

  if (Math.abs(determinant) < 0.0001) {
    return null;
  }

  const ab = ((start1.y - start2.y) * delta2x - (start1.x - start2.x) * delta2y) / determinant;

  if (ab > 0 && ab < 1) {
    const cd = ((start1.y - start2.y) * delta1x - (start1.x - start2.x) * delta1y) / determinant;

    if (cd > 0 && cd < 1) {
      const x = start1.x + ab * delta1x;
      const y = start1.y + ab * delta1y;
      return new Cartesian2(x, y);
    }
  }

  return null;
}
