import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import {executeForAllPrimitives} from '../utils.ts';
import JulianDate from 'cesium/Source/Core/JulianDate';
import SlicerArrows from './SlicerArrows.ts';
import {
  applyOffsetToPlane,
  BBox,
  createClippingPlanes, getBboxFromRectangle,
  getBboxFromViewRatio,
  getClippingPlaneFromSegment,
  getOffsetFromBbox, getPositionsOffset, moveSlicingBoxCorners
} from './helper.ts';
import {Plane} from 'cesium';
import CallbackProperty from 'cesium/Source/DataSources/CallbackProperty';
import {
  DEFAULT_CONFIG_FOR_SLICING_ARROW,
  SLICE_BOX_ARROWS_INSIDE, SLICE_BOX_ARROWS_OUTSIDE,
  SLICING_BOX_MIN_SIZE,
  SLICING_GEOMETRY_COLOR
} from '../constants';
import Cartographic from 'cesium/Source/Core/Cartographic';
import {
  pickCenterOnEllipsoid, planeFromTwoPoints, projectPointOnSegment, updateHeightForCartesianPositions
} from '../cesiumutils';
import SlicingToolBase from './SlicingToolBase.ts';
import Matrix4 from 'cesium/Source/Core/Matrix4';
import CornerType from 'cesium/Source/Core/CornerType';
import Cartesian2 from 'cesium/Source/Core/Cartesian2';
import Entity from 'cesium/Source/DataSources/Entity';

export interface SlicingBoxOptions {
  type: string | undefined,
  slicePoints: any[],
  negate: boolean | undefined,
  // activationCallback: Function,
  // deactivationCallback: Function,
  // syncBoxPlanesCallback: Function,
  lowerLimit: number,
  height: number,
  showBox: boolean | undefined,
}

export default class SlicingBox extends SlicingToolBase {

  options: SlicingBoxOptions | null = null;
  offsets: Record<string, Cartesian3> = {};
  backPlane: Plane | null = null;
  frontPlane: Plane | null = null;
  leftPlane: Plane | null = null;
  rightPlane: Plane | null = null;

  downPlane: Plane | null = null;
  upPlane: Plane | null = null;
  zPlanes: [Plane, Plane] | null = null;

  bbox: BBox | null = null;
  boxCenter: Cartesian3 | null = null;
  julianDate = new JulianDate();

  globePlanes = [];
  planesPositions: [
    [Cartesian3, Cartesian3],
    [Cartesian3, Cartesian3],
    [Cartesian3, Cartesian3],
    [Cartesian3, Cartesian3],
  ] | null = null;

  slicerArrows: SlicerArrows | null = null;
  slicingBoxEntity: Entity | null = null;
  modelMatrix: Matrix4 | null = null;
  sidePlanes: Plane[] = [];


  activate(options: SlicingBoxOptions): void {
    this.options = options;
    if (options.slicePoints && options.slicePoints.length) {
      this.bbox = getBboxFromRectangle(this.viewer, options.slicePoints, options.lowerLimit, options.height);
    } else {
      this.bbox = getBboxFromViewRatio(this.viewer, 1 / 3);
    }
    this.boxCenter = this.bbox.center;
    this.planesPositions = [
      [this.bbox.corners.bottomLeft, this.bbox.corners.bottomRight],
      [this.bbox.corners.topRight, this.bbox.corners.topLeft],
      [this.bbox.corners.bottomRight, this.bbox.corners.topRight],
      [this.bbox.corners.topLeft, this.bbox.corners.bottomLeft],
    ];
    this.options.lowerLimit = this.bbox.lowerLimit;
    this.updateSidePlanes();

    this.downPlane = Plane.fromPointNormal(this.boxCenter, Cartesian3.UNIT_Z);
    this.upPlane = Plane.fromPointNormal(this.boxCenter, Cartesian3.negate(Cartesian3.UNIT_Z, new Cartesian3()));
    this.downPlane.distance = this.options.lowerLimit ? this.options.lowerLimit * -1 : this.bbox.height / 2;
    this.upPlane.distance = this.options.lowerLimit ? this.options.lowerLimit + this.bbox.height : this.bbox.height / 2;
    this.zPlanes = [this.downPlane, this.upPlane];

    this.slicerArrows = new SlicerArrows(this.viewer,
      this.dataSource,
      {
        moveCallback: (side, moveAmount, moveVector) => this.onPlaneMove(side, moveAmount, moveVector),
        positionUpdateCallback: (side: string) => this.arrowPositionCallback(side),
        arrowsList: this.options.negate ? SLICE_BOX_ARROWS_INSIDE : SLICE_BOX_ARROWS_OUTSIDE,
        arrowConfiguration: {...DEFAULT_CONFIG_FOR_SLICING_ARROW, orientation: this.bbox.orientation}
      });
    this.slicerArrows.show();

    const boxPositions = [
      this.bbox.corners.bottomRight,
      this.bbox.corners.bottomLeft,
      this.bbox.corners.topLeft,
      this.bbox.corners.topRight,
      this.bbox.corners.bottomRight
    ];
    const scratchCartesian2 = new Cartesian2(1, 0);
    const scratchCenter = new Cartographic();
    this.slicingBoxEntity = this.dataSource.entities.add({
      position: Cartesian3.midpoint(boxPositions[0], boxPositions[2], new Cartesian3()),
      polylineVolume: {
        positions: new CallbackProperty(() => {
          const height =
            Cartographic.fromCartesian(this.boxCenter!, undefined, scratchCenter).height - (this.bbox!.height / 2);
          return updateHeightForCartesianPositions(boxPositions, height);
        }, false),
        cornerType: CornerType.MITERED,
        outline: false,
        material: SLICING_GEOMETRY_COLOR.withAlpha(0.2),
        shape: new CallbackProperty(() => [
          Cartesian2.ZERO,
          Cartesian2.ZERO,
          scratchCartesian2,
          new Cartesian2(0, this.bbox!.height),
        ], false)
      }
    });

    this.modelMatrix = this.slicingBoxEntity!.computeModelMatrix(this.julianDate);
    const planes = [...this.sidePlanes];
    if (!this.options.negate) {
      planes.push(...this.zPlanes);
    }
    this.viewer.scene.globe.clippingPlanes = createClippingPlanes(planes, !this.options.negate);

    executeForAllPrimitives(this.viewer, (primitive) => this.addClippingPlanes(primitive));
    this.syncPlanes();

    if (typeof options.showBox === 'boolean')
      this.toggleBoxVisibility(options.showBox);
    this.viewer.scene.requestRender();
  }

  deactivate() {
    this.options = null;
    this.offsets = {};
    this.backPlane = null;
    this.frontPlane = null;
    this.leftPlane = null;
    this.rightPlane = null;
    this.boxCenter = null;
    this.slicerArrows!.hide();
  }

  addClippingPlanes(primitive) {
    if (!primitive.root || !primitive.boundingSphere) return;
    this.offsets[primitive.basePath] = getOffsetFromBbox(primitive, this.bbox);
    const planes = [...this.sidePlanes];
    if (!this.options!.negate) {
      planes.push(...this.zPlanes!);
    }
    primitive.clippingPlanes = createClippingPlanes(planes, !this.options!.negate);
    this.syncPlanes();
  }

  updateBoxGlobeClippingPlanes(clippingPlanes) {
    if (!clippingPlanes) return;
    clippingPlanes.removeAll();
    this.sidePlanes.forEach(plane => clippingPlanes.add(plane));
    if (!this.options!.negate)
      this.zPlanes!.forEach(plane => clippingPlanes.add(Plane.transform(plane, this.modelMatrix!)));
  }

  updateBoxTileClippingPlanes(clippingPlanes, offset, center) {
    if (!clippingPlanes) return;
    clippingPlanes.removeAll();
    const s1 = Cartesian3.midpoint(this.planesPositions[0][0], this.planesPositions[0][1], new Cartesian3());
    const s2 = Cartesian3.midpoint(this.planesPositions[1][0], this.planesPositions[1][1], new Cartesian3());
    const dist1 = Cartesian3.distance(s1, s2);
    const s3 = Cartesian3.midpoint(this.planesPositions[2][0], this.planesPositions[2][1], new Cartesian3());
    const s4 = Cartesian3.midpoint(this.planesPositions[3][0], this.planesPositions[3][1], new Cartesian3());
    const dist2 = Cartesian3.distance(s3, s4);
    console.log(dist1, dist2);
    const planes = [];
    this.planesPositions!.forEach((positions, indx) => {
      const mapRect = this.viewer.scene.globe.cartographicLimitRectangle;
      const plane = planeFromTwoPoints(positions[0], positions[1], false);
      const bCenterOffset = getPositionsOffset(center, this.boxCenter, plane.normal);
      const pOffset = getPositionsOffset(Cartesian3.midpoint(positions[0], positions[1], new Cartesian3()), this.boxCenter, plane.normal);
      const pDist = Cartesian3.distance(Cartesian3.midpoint(positions[0], positions[1], new Cartesian3()), this.boxCenter);
      const p = getClippingPlaneFromSegment(positions[0], positions[1], center, mapRect, plane.normal);
      console.log('old', p.distance, bCenterOffset + pOffset, pDist);
      const diff = Math.abs(Math.abs(bCenterOffset + pOffset) - Math.abs(p.distance));
      console.log('diff1', diff);
      const diff2 = Math.abs(diff / 2 - pDist);
      console.log('diff2', diff2);
      if (indx === 0 || indx === 1)
        p.distance += p.distance >= 0 ? diff2 : -diff2;
      else
        p.distance -= p.distance >= 0 ? diff2 : -diff2;
      if (this.options!.negate) {
        Cartesian3.negate(p.normal, p.normal);
        p.distance *= -1;
      }
      // planes.push(p);
      clippingPlanes.add(p);
    });
    // const distDiff1 = Math.abs(dist1 - Math.abs(planes[0].distance + planes[1].distance));
    // const distDiff2 = Math.abs(dist2 - Math.abs(planes[2].distance + planes[3].distance));
    // planes.forEach((p, i) => {
    //   let distDiff = 0;
    //   if (i === 0 || i === 1) {
    //     distDiff = distDiff1;
    //   } else {
    //     distDiff = distDiff2 * 5;
    //   }
    //   console.log(distDiff);
    //   p.distance > 0 ? p.distance -= distDiff : p.distance += distDiff;
    //   console.log('new', p.distance);
    //   clippingPlanes.add(p);
    // });
    if (!this.options!.negate) {
      this.zPlanes!.forEach(plane => {
        plane = offset ? applyOffsetToPlane(plane, offset) : plane;
        clippingPlanes.add(plane);
      });
    }
  }

  onPlaneMove(side, moveAmount, moveVector) {
    const bbox = this.bbox!;
    let bothSideMove = false;
    const corners = bbox!.corners;
    switch (side) {
      case 'left': {
        bothSideMove = moveSlicingBoxCorners(corners.topLeft, corners.bottomLeft, corners.topRight, corners.bottomRight, moveVector);
        break;
      }
      case 'right': {
        bothSideMove = moveSlicingBoxCorners(corners.topRight, corners.bottomRight, corners.topLeft, corners.bottomLeft, moveVector);
        break;
      }
      case 'front': {
        bothSideMove = moveSlicingBoxCorners(corners.topLeft, corners.topRight, corners.bottomLeft, corners.bottomRight, moveVector);
        break;
      }
      case 'back': {
        bothSideMove = moveSlicingBoxCorners(corners.bottomLeft, corners.bottomRight, corners.topLeft, corners.topRight, moveVector);
        break;
      }
      case 'up':
      case 'down': {
        let boxHeight = bbox.height;
        side === 'down' ? boxHeight += moveAmount : boxHeight -= moveAmount;
        if (boxHeight < SLICING_BOX_MIN_SIZE) {
          side === 'down' ? this.upPlane!.distance -= moveAmount : this.downPlane!.distance += moveAmount;
          bothSideMove = true;
        }
        bbox.height = boxHeight < SLICING_BOX_MIN_SIZE ? SLICING_BOX_MIN_SIZE : boxHeight;
        bbox.lowerLimit = Cartographic.fromCartesian(bbox.center).height - bbox.height / 2;
        side === 'down' ? this.downPlane!.distance += moveAmount : this.upPlane!.distance -= moveAmount;
        break;
      }
    }
    bbox.width = Cartesian3.distance(corners.topLeft, corners.bottomLeft);
    bbox.length = Cartesian3.distance(corners.bottomRight, corners.bottomLeft);
    if (!bothSideMove) {
      Cartesian3.divideByScalar(moveVector, 2, moveVector);
    }
    Cartesian3.add(this.boxCenter!, moveVector, this.boxCenter!);
    this.syncPlanes();
  }

  /**
   * Positioning arrows according to view center
   * @param side
   */
  arrowPositionCallback(side: string): Cartesian3 {
    const boxCenter = Cartographic.fromCartesian(this.boxCenter!);
    const boxHeight = this.bbox!.height;
    const corners = this.bbox!.corners;

    if (side === 'up' || side === 'down') {
      const position = Cartographic.fromCartesian(corners.bottomLeft);
      position.height = side === 'down' ? -(boxHeight / 2) : boxHeight / 2;
      position.height += boxCenter.height;
      return Cartographic.toCartesian(position);
    } else {
      const viewCenter = pickCenterOnEllipsoid(this.viewer.scene) || this.boxCenter;
      if (!viewCenter) {
        return Cartesian3.ZERO; // return something
      }
      const heightOffset = 20;
      let height = boxHeight / 2 + heightOffset;
      height = this.viewer.scene.cameraUnderground ? boxCenter.height - height : boxCenter.height + height;
      const start = 0.05;
      const end = 0.95;
      switch (side) {
        case 'right':
          return projectPointOnSegment(viewCenter, corners.bottomRight, corners.topRight, start, end, height);
        case 'left':
          return projectPointOnSegment(viewCenter, corners.bottomLeft, corners.topLeft, start, end, height);
        case 'back':
          return projectPointOnSegment(viewCenter, corners.bottomRight, corners.bottomLeft, start, end, height);
        case 'front':
          return projectPointOnSegment(viewCenter, corners.topRight, corners.topLeft, start, end, height);
        default:
          return Cartesian3.ZERO; // return something
      }
    }
  }

  syncPlanes() {
    this.updateSidePlanes();
    this.updateBoxGlobeClippingPlanes(this.viewer.scene.globe.clippingPlanes);
    executeForAllPrimitives(this.viewer, (primitive) => {
      if (primitive.root && primitive.boundingSphere) {
        const transformCenter = Matrix4.getTranslation(primitive.root.transform, new Cartesian3());
        const tileCenter = Cartesian3.equals(transformCenter, Cartesian3.ZERO) ? primitive.boundingSphere.center : transformCenter;
        this.updateBoxTileClippingPlanes(primitive.clippingPlanes, this.offsets[primitive.basePath], tileCenter);
      }
    });
    this.onBoxPlanesChange();
  }

  updateSidePlanes() {
    const bbox = this.bbox!;
    const options = this.options!;
    this.backPlane = planeFromTwoPoints(bbox.corners.bottomLeft, bbox.corners.bottomRight, options.negate);
    this.frontPlane = planeFromTwoPoints(bbox.corners.topRight, bbox.corners.topLeft, options.negate);
    this.rightPlane = planeFromTwoPoints(bbox.corners.bottomRight, bbox.corners.topRight, options.negate);
    this.leftPlane = planeFromTwoPoints(bbox.corners.topLeft, bbox.corners.bottomLeft, options.negate);
    this.sidePlanes = [this.backPlane, this.leftPlane, this.frontPlane, this.rightPlane];
  }

  toggleBoxVisibility(show) {
    if (!this.slicingBoxEntity) return;
    this.slicingBoxEntity.show = show;
    this.slicerArrows!.toggleArrowsVisibility(show);
    this.onBoxPlanesChange();
    this.viewer.scene.requestRender();
  }

  onBoxPlanesChange() {
    if (!this.options || !this.options.syncBoxPlanesCallback) return;
    const bbox = this.bbox!;
    const boxCenter = Cartographic.fromCartesian(this.boxCenter!);
    const planesInfo = {
      type: this.options.type,
      slicePoints: Object.values(bbox.corners),
      lowerLimit: boxCenter.height - bbox.height / 2,
      height: bbox.height,
      showBox: this.slicingBoxEntity!.show
    };
    this.options.syncBoxPlanesCallback(planesInfo);
  }
}
