import interact from 'interactjs';

/**
 * @param {HTMLElement} target
 * @param {Interact.DraggableOptions} options
 */
export default function draggable(target, options = {}) {
  interact(target).draggable(Object.assign({
    onmove: translate,
    // keep the element within the area of it's parent
    modifiers: [
      interact.modifiers.restrictRect({
        restriction: 'parent'
      })
    ]
  }, options));

}

/**
 * @param {Interact.InteractEvent} event
 */
function translate(event) {
  const target = event.target;
  // keep the dragged position in the data-x/data-y attributes
  const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
  const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
  target.style.transform = `translate(${x}px, ${y}px)`;
  // update the position attributes
  target.setAttribute('data-x', x);
  target.setAttribute('data-y', y);
}
