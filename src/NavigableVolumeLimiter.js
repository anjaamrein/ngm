/**
 * Constrain the camera so that it stays close to the bounding sphere of the map extent.
 * Near the ground the allowed distance is shorter.
 */
export default class NavigableVolumeLimiter {
  constructor(scene, rectangle, height, ratioFunction) {
    this.blockLimiter_ = false;
    this.boundingSphere_ = Cesium.BoundingSphere.fromRectangle3D(rectangle, Cesium.Ellipsoid.WGS84, height);
    this.ratioFunction_ = ratioFunction;
    scene.postRender.addEventListener(() => this.limit_(scene), scene);
  }

  limit_(scene) {
    if (this.boundingSphere_ && !this.blockLimiter_) {
      const camera = scene.camera;
      const position = camera.position;
      const carto = Cesium.Cartographic.fromCartesian(position);
      const ratio = this.ratioFunction_(carto.height);
      if (Cesium.Cartesian3.distance(this.boundingSphere_.center, position) > this.boundingSphere_.radius * ratio) {
        const currentlyFlying = camera.flying;
        if (currentlyFlying === true) {
          // There is a flying property and its value is true
          return;
        } else {
          this.blockLimiter_ = true;
          const unblockLimiter = () => this.blockLimiter_ = false;
          camera.flyToBoundingSphere(this.boundingSphere_, {
            complete: unblockLimiter,
            cancel: unblockLimiter
          });
        }
      }
    }
  }
}

