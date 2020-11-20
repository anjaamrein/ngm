import ClippingPlaneCollection from 'cesium/Source/Scene/ClippingPlaneCollection';
import ScreenSpaceEventHandler from 'cesium/Source/Core/ScreenSpaceEventHandler';
import Plane from 'cesium/Source/Core/Plane';
import {pickCenter} from './utils.js';
import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';
import ClippingPlane from 'cesium/Source/Scene/ClippingPlane';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import Cartographic from 'cesium/Source/Core/Cartographic';
import Rectangle from 'cesium/Source/Core/Rectangle';
import Entity from 'cesium/Source/DataSources/Entity';
import CallbackProperty from 'cesium/Source/DataSources/CallbackProperty';
import Cartesian2 from 'cesium/Source/Core/Cartesian2';
import Color from 'cesium/Source/Core/Color';
import ShadowMode from 'cesium/Source/Scene/ShadowMode';
import {lv95ToDegrees, radiansToLv95} from './projection';
import CustomDataSource from 'cesium/Source/DataSources/CustomDataSource';
import ColorBlendMode from 'cesium/Source/Scene/ColorBlendMode';
import {applyLimits, pickCenterOnEllipsoid} from './utils';
import Matrix4 from 'cesium/Source/Core/Matrix4';
import HeadingPitchRoll from 'cesium/Source/Core/HeadingPitchRoll';
import Transforms from 'cesium/Source/Core/Transforms';
import {SLICE_ARROW_ICONS} from './constants';


const PLANE_HEIGHT = 15000;
const PLANE_COLOR = Color.WHITE;
const DEFAULT_SLICE_OPTIONS = {
  box: false,
  slicePoints: [],
  negate: false,
  deactivationCallback: undefined
};

export default class Slicer {
  /**
   * @param {import('cesium/Source/Widgets/Viewer/Viewer').default} viewer
   */
  constructor(viewer) {

    this.viewer = viewer;
    this.slicerDataSource = new CustomDataSource('slicer');
    this.viewer.dataSources.add(this.slicerDataSource);
    this.sliceActive = false;
    this.slicePoints = [];
    this.sliceOptions = {...DEFAULT_SLICE_OPTIONS};

    this.planeEntity = null;
    this.planesCenter = null;
    this.planesCenterH = null;
    this.planesCenterV = null;
    this.planesWidth = 0;
    this.planesHeight = 0;

    this.eventHandler = null;
    this.selectedPlane = null;
    this.targetYSouthwest = 0.0;
    this.targetXSouthwest = 0.0;
    this.targetYNortheast = 0.0;
    this.targetXNortheast = 0.0;

    this.offsets = {};
  }

  set active(value) {
    const globe = this.viewer.scene.globe;
    if (value) {
      this.sliceActive = true;
      if (this.sliceOptions.box) {
        this.activateBoxSlicing();
      } else {
        this.activateLineSlicing();
      }
    } else {
      this.sliceActive = false;
      if (this.sliceOptions.deactivationCallback) {
        this.sliceOptions.deactivationCallback();
      }
      this.sliceOptions = {...DEFAULT_SLICE_OPTIONS};
      this.slicerDataSource.entities.removeAll();
      this.offsets = {};
      this.planeHorizontalDown = null;
      this.planeHorizontalUp = null;
      this.planeVerticalLeft = null;
      this.planeVerticalRight = null;
      this.plane = null;

      if (this.eventHandler) {
        this.eventHandler.destroy();
        this.eventHandler = null;
        this.onTickRemove();
      }

      if (globe.clippingPlanes) {
        globe.clippingPlanes.enabled = false;
        globe.clippingPlanes = undefined;
      }

      this.targetYSouthwest = 0.0;
      this.targetXSouthwest = 0.0;
      this.targetYNortheast = 0.0;
      this.targetXNortheast = 0.0;
      this.targetDown = 0.0;

      const primitives = this.viewer.scene.primitives;
      for (let i = 0, ii = primitives.length; i < ii; i++) {
        const primitive = primitives.get(i);
        if (primitive.clippingPlanes) {
          primitive.clippingPlanes.enabled = false;
          primitive.clippingPlanes = undefined;
        }
      }
    }
    this.viewer.scene.requestRender();
  }

  activateBoxSlicing() {
    // initialize plane based on the camera's position
    this.setInitialTargetsForBox();

    this.planeHorizontalDown = new ClippingPlane(new Cartesian3(0.0, 1.0, 0.0), 0.0);
    this.planeHorizontalUp = new ClippingPlane(new Cartesian3(0.0, -1.0, 0.0), 0.0);
    this.planeVerticalLeft = new ClippingPlane(new Cartesian3(1.0, 0.0, 0.0), 0.0);
    this.planeVerticalRight = new ClippingPlane(new Cartesian3(-1.0, 0.0, 0.0), 0.0);
    this.planeDown = new ClippingPlane(new Cartesian3(0.0, 0, 1.0), 0.0);
    this.planeUp = new ClippingPlane(new Cartesian3(0.0, 0, -1.0), 0.0);

    const horizontalEntityTemplate = {
      position: new CallbackProperty(this.centerUpdateFunction('horizontal'), false),
      plane: {
        plane: new CallbackProperty(this.createBoxPlaneUpdateFunction(this.planeHorizontalDown, 'horizontal'), false),
        dimensions: new CallbackProperty(() => new Cartesian2(this.planesWidth, PLANE_HEIGHT), false),
        material: Color.WHITE.withAlpha(0.1),
        outline: true,
        outlineColor: PLANE_COLOR,
      }
    };

    const verticalEntityTemplate = {
      position: new CallbackProperty(this.centerUpdateFunction('vertical'), false),
      plane: {
        plane: new CallbackProperty(this.createBoxPlaneUpdateFunction(this.planeVerticalLeft, 'vertical'), false),
        dimensions: new CallbackProperty(() => new Cartesian2(this.planesHeight, PLANE_HEIGHT), false),
        material: Color.WHITE.withAlpha(0.1),
        outline: true,
        outlineColor: PLANE_COLOR,
      }
    };

    const zEntityTemplate = {
      position: new CallbackProperty(this.centerUpdateFunction('altitude'), false),
      plane: {
        plane: new CallbackProperty(this.createBoxPlaneUpdateFunction(this.planeDown, 'altitude'), false),
        dimensions: new CallbackProperty(() => new Cartesian2(this.planesWidth, this.planesHeight), false),
        material: Color.WHITE.withAlpha(0.1),
        outline: true,
        outlineColor: PLANE_COLOR,
      }
    };
    this.planeEntitDown = new Entity(zEntityTemplate);
    this.slicerDataSource.entities.add(this.planeEntitDown);

    this.planeEntityHorizontal = new Entity(horizontalEntityTemplate);
    this.slicerDataSource.entities.add(this.planeEntityHorizontal);

    horizontalEntityTemplate.plane.plane =
      new CallbackProperty(this.createBoxPlaneUpdateFunction(this.planeHorizontalUp, 'horizontal-northeast'), false);
    this.planeEntityHorizontalUp = new Entity(horizontalEntityTemplate);
    this.slicerDataSource.entities.add(this.planeEntityHorizontalUp);

    this.planeEntityVertical = new Entity(verticalEntityTemplate);
    this.slicerDataSource.entities.add(this.planeEntityVertical);

    verticalEntityTemplate.plane.plane =
      new CallbackProperty(this.createBoxPlaneUpdateFunction(this.planeVerticalRight, 'vertical-northeast'), false);
    this.planeEntityVerticalRight = new Entity(verticalEntityTemplate);
    this.slicerDataSource.entities.add(this.planeEntityVerticalRight);

    this.createMoveArrows();

    this.viewer.scene.globe.clippingPlanes = this.createClippingPlanes(this.planeEntityHorizontal.computeModelMatrix(new Date()));

    const primitives = this.viewer.scene.primitives;
    for (let i = 0, ii = primitives.length; i < ii; i++) {
      const primitive = primitives.get(i);
      if (primitive.root && primitive.boundingSphere) {
        this.offsets[primitive.url] = this.getTilesetOffset(primitive.boundingSphere.center, this.planesCenter);
        primitive.clippingPlanes = this.createClippingPlanes();
      }
    }

    if (!this.eventHandler) {
      this.eventHandler = new ScreenSpaceEventHandler(this.viewer.canvas);
      this.eventHandler.setInputAction(this.onLeftDown.bind(this), ScreenSpaceEventType.LEFT_DOWN);
      this.eventHandler.setInputAction(this.onMouseMove.bind(this), ScreenSpaceEventType.MOUSE_MOVE);
      this.eventHandler.setInputAction(this.onLeftUp.bind(this), ScreenSpaceEventType.LEFT_UP);
      const syncPlanes = this.movePlane.bind(this);
      this.onTickRemove = this.viewer.scene.postRender.addEventListener(syncPlanes);
    }
  }

  activateLineSlicing() {
    const slicePoints = this.sliceOptions.slicePoints;
    if (!slicePoints || slicePoints.length !== 2) {
      const center = pickCenter(this.viewer.scene);
      const hpr = new HeadingPitchRoll(this.viewer.scene.camera.heading, 0.0, 0.0);
      this.plane = Plane.transform(Plane.ORIGIN_ZX_PLANE, Transforms.headingPitchRollToFixedFrame(center, hpr));
    } else {
      const center = Cartesian3.midpoint(slicePoints[0], slicePoints[1], new Cartesian3());
      const cartographicPoint1 = Cartographic.fromCartesian(slicePoints[0]);
      const cartographicPoint2 = Cartographic.fromCartesian(slicePoints[1]);
      // for correct tilt
      cartographicPoint1.height = cartographicPoint1.height + 10000;
      cartographicPoint2.height = cartographicPoint2.height - 10000;
      const point1 = Cartographic.toCartesian(cartographicPoint1);
      const point2 = Cartographic.toCartesian(cartographicPoint2);
      const vector1 = Cartesian3.subtract(center, point1, new Cartesian3());
      const vector2 = Cartesian3.subtract(point2, point1, new Cartesian3());
      const cross = Cartesian3.cross(vector1, vector2, new Cartesian3());
      const normal = Cartesian3.normalize(cross, new Cartesian3());
      if (this.sliceOptions.negate) {
        Cartesian3.negate(normal, normal);
      }
      this.plane = Plane.fromPointNormal(center, normal);
    }

    this.viewer.scene.globe.clippingPlanes = this.createClippingPlanes();
    const primitives = this.viewer.scene.primitives;
    for (let i = 0, ii = primitives.length; i < ii; i++) {
      const primitive = primitives.get(i);
      if (primitive.root && primitive.root.computedTransform) {
        const modelMatrix = Matrix4.inverse(primitive.root.computedTransform, new Matrix4());
        primitive.clippingPlanes = this.createClippingPlanes(modelMatrix);
      }
    }
  }

  set options(options) {
    this.sliceOptions = options;
  }

  get active() {
    return this.sliceActive;
  }

  get options() {
    return this.sliceOptions;
  }

  movePlane() {
    this.updateBoxClippingPlanes(this.viewer.scene.globe.clippingPlanes);
    const primitives = this.viewer.scene.primitives;
    for (let i = 0; i < primitives.length; i++) {
      const primitive = primitives.get(i);
      if (primitive.clippingPlanes) {
        this.updateBoxClippingPlanes(primitive.clippingPlanes, this.offsets[primitive.url]);
      }
    }
  }

  /**
   * @param {Matrix4=} modelMatrix
   */
  createClippingPlanes(modelMatrix) {
    let planes = [this.plane];
    if (this.sliceOptions.box) {
      planes = [
        this.planeHorizontalDown, this.planeVerticalLeft, this.planeHorizontalUp, this.planeVerticalRight,
        this.planeDown
      ];
    }
    return new ClippingPlaneCollection({
      modelMatrix: modelMatrix,
      planes: planes,
      edgeWidth: 1.0,
      unionClippingRegions: true
    });
  }

  updateBoxClippingPlanes(clippingPlanes, offset) {
    clippingPlanes.removeAll();
    if (offset) {
      const planeHorizontalDown = Plane.clone(this.planeHorizontalDown);
      planeHorizontalDown.distance = planeHorizontalDown.distance - offset.offsetX;

      const planeHorizontalUp = Plane.clone(this.planeHorizontalUp);
      planeHorizontalUp.distance = planeHorizontalUp.distance + offset.offsetX;

      const planeVerticalLeft = Plane.clone(this.planeVerticalLeft);
      planeVerticalLeft.distance = planeVerticalLeft.distance - offset.offsetY;

      const planeVerticalRight = Plane.clone(this.planeVerticalRight);
      planeVerticalRight.distance = planeVerticalRight.distance + offset.offsetY;

      const planeDown = Plane.clone(this.planeDown);
      planeDown.distance = planeDown.distance - PLANE_HEIGHT / 2;

      clippingPlanes.add(planeHorizontalDown);
      clippingPlanes.add(planeHorizontalUp);
      clippingPlanes.add(planeVerticalLeft);
      clippingPlanes.add(planeVerticalRight);
      clippingPlanes.add(planeDown);
    } else {
      clippingPlanes.add(this.planeHorizontalDown);
      clippingPlanes.add(this.planeVerticalLeft);
      clippingPlanes.add(this.planeHorizontalUp);
      clippingPlanes.add(this.planeVerticalRight);
      clippingPlanes.add(this.planeDown);
    }
  }

  onLeftDown(event) {
    const pickedObject = this.viewer.scene.pick(event.position);
    const isModelPicked = pickedObject && pickedObject.id && pickedObject.id.model;
    if (isModelPicked && pickedObject.id.properties && pickedObject.id.properties.type) {
      this.selectedPlane = pickedObject.id;
      this.viewer.scene.screenSpaceCameraController.enableInputs = false;
    }
  }

  onLeftUp() {
    if (this.selectedPlane) {
      this.selectedPlane = null;
      this.viewer.scene.screenSpaceCameraController.enableInputs = true;
    }
    this.unhighlightArrow();
  }

  onMouseMove(movement) {
    if (this.selectedPlane) {
      const intersectionStart = this.viewer.camera.pickEllipsoid(movement.startPosition);
      const intersectionEnd = this.viewer.camera.pickEllipsoid(movement.endPosition);

      if (!intersectionStart || !intersectionEnd) return;
      let distance = Cartesian3.distance(intersectionStart, intersectionEnd);
      const diff = Cartesian3.subtract(intersectionEnd, intersectionStart, new Cartesian3());

      const type = this.selectedPlane.properties.type.getValue();

      // depends on selected plane type calculates plane distance
      // also updates plane entities center and dimensions (depends on type) to show planes as a box
      if (type.includes('horizontal')) {
        const cartCenter = Cartographic.fromCartesian(this.planesCenterV);
        const lv95Center = radiansToLv95([cartCenter.longitude, cartCenter.latitude]);
        if (type.includes('northeast')) {
          const negative = (diff.x + diff.y) > 0 ? -1 : 1;
          distance = distance * negative;
          lv95Center[1] = lv95Center[1] + distance / 2;
          this.targetYNortheast += distance;
          this.planesHeight = this.planeHorizontalDown.distance + this.targetYNortheast;
        } else {
          const negative = (diff.x + diff.y) > 0 ? 1 : -1;
          distance = distance * negative;
          lv95Center[1] = lv95Center[1] - distance / 2;
          this.targetYSouthwest += distance;
          this.planesHeight = this.planeHorizontalUp.distance + this.targetYSouthwest;
        }
        const degCenter = lv95ToDegrees(lv95Center);
        this.planesCenterV = Cartesian3.fromDegrees(degCenter[0], degCenter[1]);
      } else if (type.includes('vertical')) {
        const cartCenter = Cartographic.fromCartesian(this.planesCenterH);
        const lv95Center = radiansToLv95([cartCenter.longitude, cartCenter.latitude]);
        if (type.includes('northeast')) {
          const negative = (diff.x + diff.y) < 0 ? -1 : 1;
          distance = distance * negative;
          lv95Center[0] = lv95Center[0] + distance / 2;
          this.targetXNortheast += distance;
          this.planesWidth = this.planeVerticalLeft.distance + this.targetXNortheast;
        } else {
          const negative = (diff.x + diff.y) < 0 ? 1 : -1;
          distance = distance * negative;
          lv95Center[0] = lv95Center[0] - distance / 2;
          this.targetXSouthwest += distance;
          this.planesWidth = this.planeVerticalRight.distance + this.targetXSouthwest;
        }
        const degCenter = lv95ToDegrees(lv95Center);
        this.planesCenterH = Cartesian3.fromDegrees(degCenter[0], degCenter[1]);
      } else {
        const negative = (diff.x + diff.y) < 0 ? -1 : 1;
        distance = distance * negative;
        this.targetDown -= distance / 2;
      }
    } else {
      this.highlightArrow(movement.endPosition);
    }
  }

  /**
   * @param {Plane} plane
   * @param {string}type
   */
  createBoxPlaneUpdateFunction(plane, type) {
    return () => {
      if (type.includes('altitude')) {
        plane.distance = this.targetDown;
        return plane;
      }
      if (type.includes('horizontal')) {
        if (type.includes('northeast')) {
          plane.distance = this.targetYNortheast;
        } else {
          plane.distance = this.targetYSouthwest;
        }
      } else {
        if (type.includes('northeast')) {
          plane.distance = this.targetXNortheast;
        } else {
          plane.distance = this.targetXSouthwest;
        }
      }
      return plane;
    };
  }

  /**
   *
   * @param {Cartographic} viewCenter
   */
  setInitialTargetsForBox() {
    const globe = this.viewer.scene.globe;
    this.planesCenter = pickCenter(this.viewer.scene);
    let planesCenter = Cartographic.fromCartesian(this.planesCenter);
    planesCenter.height = 0;
    // check is slicing center placed on map otherwise use map center
    if (!Rectangle.contains(globe.cartographicLimitRectangle, planesCenter)) {
      planesCenter = Rectangle.center(globe.cartographicLimitRectangle);
    }

    let viewRect = this.viewer.scene.camera.computeViewRectangle();
    const mapRect = this.viewer.scene.globe.cartographicLimitRectangle;
    if (viewRect.width > mapRect.width || viewRect.height > mapRect.height) {
      viewRect = mapRect;
    }
    // get extreme points of the map
    const mapRectNortheast = Rectangle.northeast(mapRect);
    // calculate slicing rect sizes (1/3 of view)
    const sliceRectWidth = 1 / 3 * viewRect.width;
    const sliceRectHeight = 1 / 3 * viewRect.height;
    let lon = planesCenter.longitude + sliceRectWidth;
    let lat = planesCenter.latitude + sliceRectHeight;
    if (!Rectangle.contains(globe.cartographicLimitRectangle, Cartographic.fromRadians(lon, lat))) {
      lon = mapRectNortheast.longitude;
      lat = mapRectNortheast.latitude;
    }
    // moves the center of slicing. Left down corner should be placed in the view center
    planesCenter.longitude = sliceRectWidth / 2 + planesCenter.longitude;
    planesCenter.latitude = sliceRectHeight / 2 + planesCenter.latitude;
    // converts coordinates to lv95 to calculate initial planes distance in meters
    const lv95SecondPosition = radiansToLv95([lon, lat]);
    const lv95Center = radiansToLv95([planesCenter.longitude, planesCenter.latitude]);

    // calculates initial planes distance in meters
    const xDiffNortheast = lv95SecondPosition[0] - lv95Center[0];
    const xDiffSouthwest = xDiffNortheast;
    const yDiffNortheast = lv95SecondPosition[1] - lv95Center[1];
    const yDiffSouthwest = yDiffNortheast;
    this.planesWidth = xDiffNortheast + xDiffSouthwest;
    this.planesHeight = yDiffNortheast + yDiffSouthwest;

    this.targetYNortheast = yDiffNortheast;
    this.targetXNortheast = xDiffNortheast;
    this.targetYSouthwest = yDiffSouthwest;
    this.targetXSouthwest = xDiffSouthwest;
    this.targetDown = planesCenter.height + PLANE_HEIGHT / 2;
    this.planesCenter = Cartographic.toCartesian(planesCenter);
    this.planesCenterH = this.planesCenter;
    this.planesCenterV = this.planesCenter;
  }

  getTilesetOffset(tilesetCenter, mapCenter) {
    const tileCenter = Cartographic.fromCartesian(tilesetCenter);
    const cartCenter = Cartographic.fromCartesian(mapCenter);
    const lv95Center = radiansToLv95([cartCenter.longitude, cartCenter.latitude]);
    const lv95Tile = radiansToLv95([tileCenter.longitude, tileCenter.latitude]);
    const offsetX = lv95Center[1] - lv95Tile[1];
    const offsetY = lv95Center[0] - lv95Tile[0];
    const offsetZ = cartCenter.height - tileCenter.height;
    return {
      offsetX: offsetX,
      offsetY: offsetY,
      offsetZ: offsetZ,
    };
  }

  applyClippingPlanesToTileset(tileset) {
    if (tileset.readyPromise) {
      tileset.readyPromise.then(primitive => {
        if (primitive.root && primitive.boundingSphere && !primitive.clippingPlanes) {
          if (this.sliceOptions.box) {
            this.offsets[primitive.url] = this.getTilesetOffset(primitive.boundingSphere.center, this.planesCenter);
            primitive.clippingPlanes = this.createClippingPlanes();
          } else {
            const modelMatrix = Matrix4.inverse(primitive.root.computedTransform, new Matrix4());
            primitive.clippingPlanes = this.createClippingPlanes(modelMatrix);
          }
        }
      });
    }
  }

  centerUpdateFunction(type) {
    return () => {
      if (type === 'horizontal')
        return this.planesCenterH;
      else if (type === 'vertical')
        return this.planesCenterV;
      else
        return this.planesCenter;
    };
  }

  arrowCenterUpdateFunction(type) {
    return () => {
      const cartCenterH = Cartographic.fromCartesian(this.planesCenterH);
      const cartCenterV = Cartographic.fromCartesian(this.planesCenterV);
      const lv95Center = radiansToLv95([cartCenterH.longitude, cartCenterV.latitude]);

      let viewCenterLv95 = lv95Center;
      const viewCenter = pickCenterOnEllipsoid(this.viewer.scene);
      if (viewCenter) {
        const viewCenterCart = Cartographic.fromCartesian(viewCenter);
        viewCenterLv95 = radiansToLv95([viewCenterCart.longitude, viewCenterCart.latitude]);
      }

      let height = PLANE_HEIGHT / 2;
      if (this.viewer.scene.cameraUnderground) {
        height = -height;
      }
      const negate = type.includes('northeast') ? 1 : -1;
      const offset = 5000;
      let lon, lat;
      if (type.includes('horizontal')) {
        const horizontalMin = lv95Center[0] - this.planesWidth / 2 + offset;
        const horizontalMax = lv95Center[0] + this.planesWidth / 2 - offset;
        lon = applyLimits(viewCenterLv95[0], horizontalMin, horizontalMax);
        lat = lv95Center[1] + this.planesHeight / 2 * negate;
      } else if (type.includes('vertical')) {
        const verticalMin = lv95Center[1] - this.planesHeight / 2 + offset;
        const varticalMax = lv95Center[1] + this.planesHeight / 2 - offset;
        lat = applyLimits(viewCenterLv95[1], verticalMin, varticalMax);
        lon = lv95Center[0] + this.planesWidth / 2 * negate;
      } else {
        lon = lv95Center[0] - this.planesWidth / 2;
        lat = lv95Center[1] - this.planesHeight / 2;
        height -= this.targetDown + PLANE_HEIGHT / 2;
      }
      const degCenter = lv95ToDegrees([lon, lat]);
      return Cartesian3.fromDegrees(degCenter[0], degCenter[1], height);
    };
  }

  createMoveArrows() {
    const navigationIconTemplate = {
      model: {
        minimumPixelSize: 64,
        scale: 5000,
        maximumScale: 25000,
        shadowMode: ShadowMode.DISABLED,
        colorBlendMode: ColorBlendMode.MIX,
        color: PLANE_COLOR
      },
      properties: {}
    };
    SLICE_ARROW_ICONS.forEach(icon => {
      const navigationIcon = navigationIconTemplate;
      navigationIcon.position = new CallbackProperty(this.arrowCenterUpdateFunction(icon.type), false);
      navigationIcon.properties.type = icon.type;
      navigationIcon.model.uri = icon.uri;
      this.slicerDataSource.entities.add(new Entity(navigationIcon));
    });
  }

  highlightArrow(position) {
    const pickedObject = this.viewer.scene.pick(position);
    const isModelPicked = pickedObject && pickedObject.id && pickedObject.id.model;
    if (isModelPicked && pickedObject.id.properties && pickedObject.id.properties.type) {
      this.highlightedArrow = pickedObject.id;
      document.querySelector('.cesium-widget').style.cursor = 'pointer';
      this.highlightedArrow.model.color = Color.YELLOW;
    } else {
      this.unhighlightArrow();
    }
  }

  unhighlightArrow() {
    if (this.highlightedArrow) {
      this.highlightedArrow.model.color = PLANE_COLOR;
      this.highlightedArrow = undefined;
      document.querySelector('.cesium-widget').style.cursor = '';
    }
  }
}
