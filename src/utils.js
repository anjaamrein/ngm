import Cartesian3 from 'cesium/Core/Cartesian3.js';
import CMath from 'cesium/Core/Math';


export async function readTextFile(url) {
  const response = await fetch(url);
  try {
    return await response.text();
  } catch (e) {
    console.warn(e);
  }
}

/**
 * @param {import('cesium/Scene/Camera').default} camera
 * @param {number} height Camera height in meters.
 */
export function setCameraHeight(camera, height) {
  const pc = camera.positionCartographic;
  camera.position = Cartesian3.fromRadians(pc.longitude, pc.latitude, height);
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


export function onAccordionClick(evt) {
  let target = evt.target;
  while (!target.classList.contains('title')) {
    target = target.parentElement;
  }
  if (!target.nextElementSibling) return;
  target.classList.toggle('active');
  target.nextElementSibling.classList.toggle('active');
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
