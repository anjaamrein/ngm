import ScreenSpaceEventHandler from 'cesium/Source/Core/ScreenSpaceEventHandler';
import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';
import CallbackProperty from 'cesium/Source/DataSources/CallbackProperty';
import Color from 'cesium/Source/Core/Color';
import HeightReference from 'cesium/Source/Scene/HeightReference';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import Cartesian2 from 'cesium/Source/Core/Cartesian2';
import Cartographic from 'cesium/Source/Core/Cartographic';
import VerticalOrigin from 'cesium/Source/Scene/VerticalOrigin';
import HorizontalOrigin from 'cesium/Source/Scene/HorizontalOrigin';
import JulianDate from 'cesium/Source/Core/JulianDate';

// Safari and old versions of Edge are not able to extends EventTarget
import {EventTarget} from 'event-target-shim';
import {getDimensionLabel} from './helpers.js';
import {getMeasurements} from '../utils.js';
import CustomDataSource from 'cesium/Source/DataSources/CustomDataSource';

/**
 * @typedef {"point" | "line" | "polygon" | "rectangle"} ShapeType
 */

/**
 * @typedef {object} Options
 * @property {string|Color} [strokeColor='rgba(0, 153, 255, 0.75)']
 * @property {number} [strokeWidth=4]
 * @property {string|Color} [fillColor='rgba(0, 153, 255, 0.3)']
 */

export class CesiumDraw extends EventTarget {

  /**
   * @param {import('cesium/Source/Widgets/Viewer/Viewer').default} viewer
   * @param {ShapeType} type
   * @param {Options} [options]
   */
  constructor(viewer, type, options = {}) {
    super();
    this.viewer_ = viewer;
    this.type = type;
    this.julianDate = new JulianDate();

    this.drawingDataSource = new CustomDataSource('drawing');
    this.viewer_.dataSources.add(this.drawingDataSource);

    this.strokeColor_ = options.strokeColor instanceof Color ?
      options.strokeColor : Color.fromCssColorString(options.strokeColor || 'rgba(0, 153, 255, 0.75)');
    this.strokeWidth_ = options.strokeWidth !== undefined ? options.strokeWidth : 4;
    this.fillColor_ = options.fillColor instanceof Color ?
      options.fillColor : Color.fromCssColorString(options.fillColor || 'rgba(0, 153, 255, 0.3)');

    this.eventHandler_ = undefined;
    this.activePoints_ = [];
    this.activePoint_ = undefined;
    this.activeEntity_ = undefined;
    this.sketchPoint_ = undefined;
    this.sketchLine_ = undefined;
    this.activeDistance_ = 0;
    this.activeDistances_ = [];
    this.entityForEdit = undefined;
    this.leftPressedPixel_ = undefined;
    this.moveEntity = false;
    this.sketchPoints_ = [];

    this.entities_ = [];

    this.ERROR_TYPES = {needMorePoints: 'need_more_points'};
  }

  renderSceneIfTranslucent() {
    // because calling render decreases performance, only call it when needed.
    // see https://cesium.com/docs/cesiumjs-ref-doc/Scene.html#pickTranslucentDepth
    if (this.viewer_.scene.globe.translucency.enabled) {
      this.viewer_.scene.render();
    }
  }

  /**
   *
   */
  get active() {
    return this.eventHandler_ !== undefined;
  }

  /**
   *
   */
  set active(value) {
    if (value) {
      if (!this.eventHandler_) {
        this.eventHandler_ = new ScreenSpaceEventHandler(this.viewer_.canvas);
        if (this.entityForEdit) {
          this.activateEditing();
        } else {
          this.eventHandler_.setInputAction(this.onLeftClick_.bind(this), ScreenSpaceEventType.LEFT_CLICK);
          this.eventHandler_.setInputAction(this.onDoubleClick_.bind(this), ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        }
        this.eventHandler_.setInputAction(this.onMouseMove_.bind(this), ScreenSpaceEventType.MOUSE_MOVE);
      }
    } else {
      if (this.eventHandler_) {
        this.eventHandler_.destroy();
      }
      this.eventHandler_ = undefined;
    }
    this.dispatchEvent(new CustomEvent('statechanged'));
  }

  activateEditing() {
    this.eventHandler_.setInputAction(event => this.onLeftDown_(event), ScreenSpaceEventType.LEFT_DOWN);
    this.eventHandler_.setInputAction(event => this.onLeftUp_(event), ScreenSpaceEventType.LEFT_UP);
    let positions = [];
    let createVirtualSPs = false;
    switch (this.type) {
      case 'line':
        positions = [...this.entityForEdit.polyline.positions.getValue()];
        createVirtualSPs = true;
        break;
      case 'polygon':
        positions = [...this.entityForEdit.polygon.hierarchy.getValue().positions];
        createVirtualSPs = true;
        break;
      case 'rectangle':
        positions = [...this.entityForEdit.polygon.hierarchy.getValue().positions];
        positions.pop();
        break;
      default:
        break;
    }

    positions.forEach((p, idx) => {
      this.activePoints_.push(p);
      const sketchPoint = this.createSketchPoint_(p, {edit: true, positionIndex: idx});
      sketchPoint.properties.index = idx;
      this.sketchPoints_.push(sketchPoint);
      if (createVirtualSPs && (idx + 1) < positions.length) {
        const p2 = this.halfwayPosition_(p, positions[idx + 1]);
        const virtualSketchPoint = this.createSketchPoint_(p2, {edit: true, virtual: true});
        virtualSketchPoint.properties.index = idx;
        this.sketchPoints_.push(virtualSketchPoint);
      }
    });
    if (this.type === 'polygon' && positions.length > 2) {
      // We need one more virtual sketchpoint for polygons
      const lastIdx = positions.length - 1;
      const p2 = this.halfwayPosition_(positions[lastIdx], positions[0]);
      const virtualSketchPoint = this.createSketchPoint_(p2, {edit: true, virtual: true});
      virtualSketchPoint.properties.index = lastIdx;
      this.sketchPoints_.push(virtualSketchPoint);
    }
    this.viewer_.scene.requestRender();
  }

  /**
   *
   */
  finishDrawing() {
    this.activePoints_.pop();
    let positions = this.activePoints_;
    if ((this.type === 'polygon' || this.type === 'rectangle') && positions.length < 3) {
      this.dispatchEvent(new CustomEvent('drawerror', {
        detail: {
          error: this.ERROR_TYPES.needMorePoints
        }
      }));
      return;
    }
    if (this.type === 'point') {
      positions.push(this.activePoint_);
      this.entities_.push(this.drawShape_(this.activePoint_));
    } else if (this.type === 'rectangle') {
      positions = rectanglify(this.activePoints_);
      this.entities_.push(this.drawShape_(positions));
    } else {
      if (this.type === 'polygon') {
        const distance = Cartesian3.distance(this.activePoints_[this.activePoints_.length - 1], this.activePoints_[0]);
        this.activeDistances_.push(distance / 1000);
      }
      this.entities_.push(this.drawShape_(this.activePoints_));
    }
    this.viewer_.scene.requestRender();

    const measurements = getMeasurements(positions, this.activeDistances_, this.type);
    this.dispatchEvent(new CustomEvent('drawend', {
      detail: {
        positions: positions.map(cartesiantoDegrees),
        type: this.type,
        measurements: measurements
      }
    }));

    this.removeSketches();
  }

  removeSketches() {
    this.drawingDataSource.entities.removeAll();

    this.activePoints_ = [];
    this.activePoint_ = undefined;
    this.activeEntity_ = undefined;
    this.sketchPoint_ = undefined;
    this.sketchLine_ = undefined;
    this.activeDistance_ = 0;
    this.activeDistances_ = [];
    this.entityForEdit = undefined;
    this.leftPressedPixel_ = undefined;
    this.moveEntity = false;
    this.sketchPoints_ = [];
  }

  /**
   *
   */
  clear() {
    this.removeSketches();
  }

  createSketchPoint_(position, options = {}) {
    const entity = {
      position: position,
      point: {
        color: options.virtual ? Color.GREY : Color.WHITE,
        outlineWidth: 1,
        outlineColor: Color.BLACK,
        pixelSize: options.edit ? 9 : 5,
        heightReference: HeightReference.CLAMP_TO_GROUND
      },
      properties: {}
    };
    if (options.edit) {
      entity.point.disableDepthTestDistance = Number.POSITIVE_INFINITY;
    } else {
      entity.label = getDimensionLabel(this.type, this.activeDistances_);
    }
    const pointEntity = this.drawingDataSource.entities.add(entity);
    if (options.edit && this.type === 'rectangle') {
      const isLastPoint = options.positionIndex === 2; // always 3 points for rectangle
      const billboard = {
        position: new CallbackProperty(() => pointEntity.position.getValue(this.julianDate), false),
        billboard: {
          image: isLastPoint ? './images/move-edit-icon.svg' : './images/edit-icons.svg',
          scale: isLastPoint ? 0.06 : 0.2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          horizontalOrigin: HorizontalOrigin.LEFT,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian2(10, -10)
        }
      };
      this.drawingDataSource.entities.add(billboard);
    }

    pointEntity.properties.virtual = options.virtual;
    return pointEntity;
  }

  createSketchLine_(positions) {
    return this.drawingDataSource.entities.add({
      polyline: {
        positions: positions,
        clampToGround: true,
        width: this.strokeWidth_,
        material: this.strokeColor_
      }
    });
  }

  drawShape_(positions) {
    if (this.type === 'point') {
      return this.drawingDataSource.entities.add({
        position: positions,
        point: {
          color: this.fillColor_,
          outlineWidth: 2,
          outlineColor: this.strokeColor_,
          pixelSize: this.strokeWidth_,
          heightReference: HeightReference.CLAMP_TO_GROUND
        }
      });

    } else if (this.type === 'line') {
      return this.drawingDataSource.entities.add({
        position: positions[positions.length - 1],
        polyline: {
          positions: positions,
          clampToGround: true,
          width: this.strokeWidth_,
          material: this.strokeColor_
        },
        label: getDimensionLabel(this.type, this.activeDistances_)
      });
    } else if (this.type === 'polygon' || this.type === 'rectangle') {
      return this.drawingDataSource.entities.add({
        position: positions[positions.length - 1],
        polygon: {
          hierarchy: positions,
          material: this.fillColor_
        },
        label: getDimensionLabel(this.type, this.activeDistances_)
      });
    }
  }

  dynamicSketLinePositions() {
    return new CallbackProperty(() => {
      const activePoints = [...this.activePoints_, this.activePoint_];
      const positions = this.type === 'rectangle' ? rectanglify(activePoints) : activePoints;
      if (this.type === 'rectangle' && activePoints.length === 4) { // to avoid showing of confusing lines
        return [];
      }
      if (positions.length >= 3 && this.type !== 'line') {
        // close the polygon
        // FIXME: better memory management
        return [...positions, positions[0]];
      } else {
        return positions;
      }
    }, false);
  }

  updateSketchPoint() {
    const activePoints = [...this.activePoints_, this.activePoint_];
    const positions = this.type === 'rectangle' ? rectanglify(activePoints) : activePoints;
    const pointsLength = positions.length;
    if (pointsLength > 1) {
      let distance;
      if (this.type === 'rectangle' && pointsLength > 2) {
        const b = positions[1]; //according to rectanglify
        const bp = positions[2];
        distance = Cartesian3.distance(b, bp);
        this.sketchPoint_.position.setValue(bp);
      } else {
        const lastPoint = positions[pointsLength - 1];
        distance = Cartesian3.distance(positions[pointsLength - 2], lastPoint);
        this.sketchPoint_.position.setValue(lastPoint);
      }
      this.activeDistance_ = distance / 1000;
      this.sketchPoint_.label.text.setValue(`${this.activeDistance_.toFixed(3)}km`);
      return;
    }
    this.sketchPoint_.label.text.setValue('0km');
  }

  onLeftClick_(event) {
    this.renderSceneIfTranslucent();
    const position = Cartesian3.clone(this.viewer_.scene.pickPosition(event.position));
    if (position) {
      if (!this.sketchPoint_) {
        this.dispatchEvent(new CustomEvent('drawstart'));
        this.sketchPoint_ = this.createSketchPoint_(position);
        this.activePoint_ = position;

        this.sketchLine_ = this.createSketchLine_(this.dynamicSketLinePositions());

        if (this.type === 'point') {
          this.activePoints_.push(position);
          this.finishDrawing();
          return;
        }
      } else if (!this.activeDistances_.includes(this.activeDistance_)) {
        this.activeDistances_.push(this.activeDistance_);
      }
      this.activePoints_.push(Cartesian3.clone(this.activePoint_));
      if (this.type === 'rectangle' && this.activePoints_.length === 4) {
        this.finishDrawing();
      }
    }
  }

  onMouseMove_(event) {
    this.renderSceneIfTranslucent();
    const position = Cartesian3.clone(this.viewer_.scene.pickPosition(event.endPosition));
    if (!position) return;
    if (this.entityForEdit && !!this.leftPressedPixel_) {
      if (this.moveEntity) {
        if (this.type === 'point') {
          this.entityForEdit.position = position;
        } else {
          this.sketchPoint_.position = position;
          this.activePoints_[this.sketchPoint_.properties.index] = position;
          if (this.type === 'polygon') {
            // move virtual SPs
            const idx = this.sketchPoint_.properties.index;
            const spLen = this.sketchPoints_.length;
            const prevRealSPIndex = ((spLen + idx - 1) * 2) % spLen;
            const prevRealSP = this.sketchPoints_[prevRealSPIndex];
            const prevVirtualPosition = this.halfwayPosition_(prevRealSP, this.sketchPoint_);
            this.sketchPoints_[prevRealSPIndex + 1].position = prevVirtualPosition;

            const nextRealSPIndex = ((spLen + idx + 1) * 2) % spLen;
            const nextRealSP = this.sketchPoints_[nextRealSPIndex];
            const nextVirtualPosition = this.halfwayPosition_(nextRealSP, this.sketchPoint_);
            this.sketchPoints_[idx * 2 + 1].position = nextVirtualPosition;
          }
          if (this.type === 'line') {
            // move virtual SPs
            const idx = this.sketchPoint_.properties.index;
            if (idx > 0) {
              const prevRealSP = this.sketchPoints_[(idx - 1) * 2];
              const prevVirtualPosition = this.halfwayPosition_(prevRealSP, this.sketchPoint_);
              this.sketchPoints_[(idx - 1) * 2 + 1].position = prevVirtualPosition;
            }
            if (idx < (this.activePoints_.length - 1)) {
              const nextRealSP = this.sketchPoints_[(idx + 1) * 2];
              const nextVirtualPosition = this.halfwayPosition_(nextRealSP, this.sketchPoint_);
              this.sketchPoints_[(idx + 1) * 2 - 1].position = nextVirtualPosition;
            }
            this.entityForEdit.polyline.positions = this.activePoints_;
          } else {
            let positions = this.activePoints_;
            if (this.type === 'rectangle') {
              positions = rectanglify(this.activePoints_);
              this.sketchPoints_.forEach((sp, key) => {
                sp.position = positions[key];
              });
            }
            this.entityForEdit.polygon.hierarchy = {positions};
          }
        }
      }
    } else if (this.sketchPoint_) {
      this.activePoint_ = position;
      this.updateSketchPoint();
    }
  }

  onDoubleClick_() {
    if (!this.activeDistances_.includes(this.activeDistance_)) {
      this.activeDistances_.push(this.activeDistance_);
    }
    this.finishDrawing();
  }

  /**
   * Enables moving of point geometry or one of the sketch points for other geometries if left mouse button pressed on it
   * @param event
   * @private
   */
  onLeftDown_(event) {
    this.leftPressedPixel_ = Cartesian2.clone(event.position);
    if (this.entityForEdit) {
      const objects = this.viewer_.scene.drillPick(event.position, 5, 5, 5);
      if (objects.length) {
        const selectedPoint = objects.find(obj => !!obj.id.point || !!obj.id.billboard);
        if (!selectedPoint) return;
        const selectedEntity = selectedPoint.id;
        this.sketchPoint_ = selectedEntity;
        this.moveEntity = selectedEntity.id === this.entityForEdit.id ||
          this.sketchPoints_.some(sp => sp.id === selectedEntity.id); // checks if picked entity is point geometry or one of the sketch points for other geometries
          if (this.moveEntity && this.sketchPoint_.properties.virtual) {
            this.extendOrSplitLineOrPolygonPositions_();
          }
      }
      if (this.moveEntity) {
        this.viewer_.scene.screenSpaceCameraController.enableInputs = false;
      }
    }
    this.dispatchEvent(new CustomEvent('leftdown'));
  }

  /**
   *
   * @param {*} a
   * @param {*} b
   * @return {Cartesian3}
   */
  halfwayPosition_(a, b) {
    a = a.position || a;
    b = b.position || b;
    a = a.getValue ? a.getValue(this.julianDate) : a;
    b = b.getValue ? b.getValue(this.julianDate) : b;
    const position = Cartesian3.add(a, b, new Cartesian3());
    Cartesian3.divideByScalar(position, 2, position);
    return position;
  }

  extendOrSplitLineOrPolygonPositions_() {
    // Add new line vertex
    // Create SPs, reuse the pressed virtual SP for first segment
    const pressedVirtualSP = this.sketchPoint_;
    const pressedPosition = Cartesian3.clone(pressedVirtualSP.position.getValue(this.julianDate));
    const pressedIdx = pressedVirtualSP.properties.index;
    const realSP0 = this.sketchPoints_[pressedIdx * 2];
    const realSP2 = this.sketchPoints_[((pressedIdx + 1) * 2) % (this.sketchPoints_.length)];
    const virtualPosition0 = this.halfwayPosition_(realSP0, pressedPosition);
    const virtualPosition1 = this.halfwayPosition_(pressedPosition, realSP2);
    const realSP1 = this.createSketchPoint_(pressedPosition, {edit: true});
    const virtualSP1 = this.createSketchPoint_(virtualPosition1, {edit: true, virtual: true});
    const virtualSP0 = pressedVirtualSP; // the pressed SP is reused
    virtualSP0.position = virtualPosition0; // but its position is changed

    this.insertVertexToPolylineOrPolygon_(pressedIdx + 1, pressedPosition.clone());
    this.sketchPoints_.splice((pressedIdx + 1) * 2, 0, realSP1, virtualSP1);
    this.sketchPoints_.forEach((sp, idx) => sp.properties.index = Math.floor(idx / 2));
    this.sketchPoint_ = realSP1;
    this.viewer_.scene.requestRender();
  }

  insertVertexToPolylineOrPolygon_(idx, coordinates) {
    const e = this.entityForEdit;
    this.activePoints_.splice(idx, 0, coordinates);
    switch (this.type) {
      case 'polygon': {
        const hierarchy = e.polygon.hierarchy.getValue();
        hierarchy.positions = this.activePoint_;
        e.polygon.hierarchy.setValue({...hierarchy});
        break;
      }
      case 'line': {
        e.polyline.positions = this.activePoints_;
        break;
      }
      default:
        break;
    }
  }

  /**
   * @param event
   */
  onLeftUp_(event) {
    this.viewer_.scene.screenSpaceCameraController.enableInputs = true;
    const wasAClick = Cartesian2.equalsEpsilon(event.position, this.leftPressedPixel_, 0, 2);
    if (wasAClick) {
      this.onLeftDownThenUp_(event);
    }
    this.moveEntity = false;
    this.leftPressedPixel_ = undefined;
    this.sketchPoint_ = undefined;
    this.dispatchEvent(new CustomEvent('leftup'));
  }

    /**
   * @param event
   */
  onLeftDownThenUp_(event) {
    const e = this.entityForEdit;
    const sp = this.sketchPoint_;
    if (sp && sp.properties.index !== undefined && !sp.properties.virtual) {
      let divider = 1;
      switch (this.type) {
        case 'polygon': {
          const hierarchy = e.polygon.hierarchy.getValue();
          if (hierarchy.positions.length <= 3) {
            return;
          }
          hierarchy.positions.splice(this.sketchPoint_.properties.index, 1);
          e.polygon.hierarchy.setValue({...hierarchy});
          divider = 2;
          break;
        }
        case 'line': {
          const pPositions = e.polyline.positions.getValue();
          if (pPositions.length <= 2) {
            return;
          }
          pPositions.splice(this.sketchPoint_.properties.index, 1);
          e.polyline.positions = pPositions;
          divider = 2;
          break;
        }
        default:
          break;
      }
      // a real sketch point was clicked => remove it
      if (divider === 2) {
        const pressedIdx = this.sketchPoint_.properties.index;
        const pressedIdx2 = pressedIdx * 2;
        const isLine = this.type === 'line';
        const firstPointClicked = isLine && pressedIdx === 0;
        const lastPointClicked = isLine && (pressedIdx === this.activePoints_.length - 1);

        if (!firstPointClicked && !lastPointClicked) {
          // Move previous virtual SP in the middle of preRealSP and nextRealSP
          const prevRealSPIndex2 = (this.sketchPoints_.length + pressedIdx2 - 2) % (this.sketchPoints_.length);
          const nextRealSPIndex2 = (pressedIdx2 + 2) % (this.sketchPoints_.length);
          const prevRealSP = this.sketchPoints_[prevRealSPIndex2];
          const prevVirtualSP = this.sketchPoints_[prevRealSPIndex2 + 1];
          const nextRealSP = this.sketchPoints_[nextRealSPIndex2];
          const newPosition = this.halfwayPosition_(prevRealSP, nextRealSP);
          prevVirtualSP.position = newPosition;
        }

        let removedSPs;
        if (lastPointClicked) {
          // remove 2 SPs backward
          removedSPs = this.sketchPoints_.splice(pressedIdx2 - 1, 2);
        } else {
          // remove 2 SP forward
          removedSPs = this.sketchPoints_.splice(pressedIdx2, 2);
        }
        this.sketchPoints_.forEach((s, index) => s.properties.index = Math.floor(index / divider));
        removedSPs.forEach(s => this.drawingDataSource.entities.remove(s));
      } else {
        this.sketchPoints_.splice(this.sketchPoint_.properties.index, 1);
        this.sketchPoints_.forEach((sp, idx) => sp.properties.index = idx);
        this.drawingDataSource.entities.remove(this.sketchPoint_);
      }
      this.viewer_.scene.requestRender();
    }
  }
}

const scratchAB = new Cartesian3();
const scratchAC = new Cartesian3();
const scratchAM = new Cartesian3();
const scratchAP = new Cartesian3();
const scratchBP = new Cartesian3();

function rectanglify(coordinates) {
  if (coordinates.length === 3) {
    // A and B are the base of the triangle, C is the point currently moving:
    //
    // A -- AP
    // |\
    // | \
    // |  \
    // |   \
    // M    C
    // |
    // B -- BP

    const A = coordinates[0];
    const B = coordinates[1];
    const C = coordinates[2];

    // create the two vectors from the triangle coordinates
    const AB = Cartesian3.subtract(B, A, scratchAB);
    const AC = Cartesian3.subtract(C, A, scratchAC);

    const AM = Cartesian3.projectVector(AC, AB, scratchAM);

    const AP = Cartesian3.subtract(C, AM, scratchAP).clone();
    const BP = Cartesian3.add(AP, AB, scratchBP).clone();

    // FIXME: better memory management
    return [A, B, BP, AP];
  } else {
    return coordinates;
  }
}


/**
 * @param {import('cesium/Source/Core/Cartesian3').default} cartesian
 * @return {Array<number>}
 */
function cartesiantoDegrees(cartesian) {
  const cartographic = Cartographic.fromCartesian(cartesian);
  return [
    cartographic.longitude * 180 / Math.PI,
    cartographic.latitude * 180 / Math.PI,
    cartographic.height
  ];
}
