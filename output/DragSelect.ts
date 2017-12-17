DragSelect
export class DragSelect {
	constructor  {

  this.multiSelectKeyPressed;
  this.initialCursorPos;
  this.initialScroll;
  this.selected = [];

  this.createBindings();
  this.setupOptions( options );
  this.start();

}

/**
 * Binds the `this` to the event listener functions
 */
private createBindings  () {

  this.startUp = this.startUp.bind(this);
  this.handleMove = this.handleMove.bind(this);
  this.reset = this.reset.bind(this);
  this.onClick = this.onClick.bind(this);

};

/**
 * Setup the options
 */
private setupOptions  ( options ) {

  this.selectables = [];
  this.handleSelectables( this.toArray( options.selectables ) );

  this.multiSelectKeys = options.multiSelectKeys || ['ctrlKey', 'shiftKey', 'metaKey'];
  this.autoScrollSpeed = options.autoScrollSpeed || 1;
  this.selectCallback = options.onElementSelect || function() {};
  this.unselectCallback = options.onElementUnselect || function() {};
  this.moveStartCallback = options.onDragStart || function() {};
  this.moveCallback = options.onDragMove || function() {};
  this.callback = options.callback || function() {};
  this.area = options.area || document;
  this.customStyles = options.customStyles;

  // Area has to have a special position attribute for calculations
  if( this.area !== document ) {
    var computedArea = getComputedStyle( this.area );
    var isPositioned = computedArea.position === 'absolute' || computedArea.position === 'relative' || computedArea.position === 'fixed';
    if( !isPositioned ) { this.area.style.position = 'relative'; }
  }

  // Selector
  this.selector = options.selector || this.createSelector();
  this.addClass( this.selector, 'ds-selector' );

};

/**
 * Add/Remove Selectables also handles css classes and event listeners.
 * 
 * @param {Object} selectables - selectable elements.
 * @param {Boolean} remove - if elements should be removed.
 * @param {Boolean} fromSelection - if elements should also be added/removed to the selection.
 */
private handleSelectables  ( selectables, remove, fromSelection ) {

  for ( var index = 0; index < selectables.length; index++ ) {
    var selectable = selectables[index];
    var indexOf = this.selectables.indexOf( selectable );

    if( indexOf < 0 && !remove ) {  // add
      
      this.addClass( selectable, 'ds-selectable' );
      selectable.addEventListener( 'click', this.onClick );
      this.selectables.push( selectable );
      
      // also add to current selection
      if( fromSelection && this.selected.indexOf( selectable ) < 0 ) {
        this.addClass( selectable, 'ds-selected' );
        this.selected.push( selectable );
      }

    }

    else if( indexOf > -1 && remove ) {  // remove

      this.removeClass( selectable, 'ds-hover' );
      this.removeClass( selectable, 'ds-selectable' );
      selectable.removeEventListener( 'click', this.onClick );
      this.selectables.splice( indexOf, 1 );

      // also remove from current selection
      if( fromSelection && this.selected.indexOf( selectable ) > -1 ) {
        this.removeClass( selectable, 'ds-selected' );
        this.selected.splice( this.selected.indexOf( selectable ), 1 );
      }

    }
  }

};

/**
 * Triggers when a node is actively selected.
 * 
 * This might be an "onClick" method but it also triggers when
 * <button> nodes are pressed via the keyboard.
 * Making DragSelect accessible for everyone!
 * 
 * @param {Object} selectables - selectable elements.
 * @param {Boolean} remove - if elements were removed.
 */
private onClick  ( event ) {
  if( this.mouseInteraction ) { return; }  // fix firefox doubleclick issue

  var node = event.target;

  this.isMultiSelectKeyPressed( event );
  this.checkIfInsideSelection( true );  // reset selection if no multiselectionkeypressed

  if( this.selectables.indexOf( node ) > -1 ) {
    this.toggle( node );
    this.reset();
  }

};

/**
 * Create the selector node when not provided by options object.
 * 
 * @return {Node}
 */
private createSelector  () {

  var selector = document.createElement( 'div' );

  selector.style.position = 'absolute';
  if( !this.customStyles ) {
    selector.style.background = 'rgba(0, 0, 255, 0.1)';
    selector.style.border = '1px solid rgba(0, 0, 255, 0.45)';
    selector.style.display = 'none';
    selector.style.pointerEvents = 'none';  // fix for issue #8 (ie11+)
  }

  var _area = this.area === document ? document.body : this.area;
  _area.appendChild( selector );

  return selector;

};

// Start
//////////////////////////////////////////////////////////////////////////////////////

/**
 * Starts the functionality. Automatically triggered when created.
 */
start  () {

  this.area.addEventListener( 'mousedown', this.startUp );

};

/**
 * Startup when the area is clicked.
 * 
 * @param {Object} event - The event object.
 */
private startUp  ( event ) {

  this.mouseInteraction = true;
  this.selector.style.display = 'block';

  this.isMultiSelectKeyPressed( event );

  // move element on location
  this.getStartingPositions( event );
  this.checkIfInsideSelection( true );

  this.selector.style.display = 'none';  // hidden unless moved, fix for issue #8

  // callback
  this.moveStartCallback( event );
  if( this.breaked ) { return false; }

  // event listeners
  this.area.removeEventListener( 'mousedown', this.startUp );
  this.area.addEventListener( 'mousemove', this.handleMove );
  this.area.addEventListener( 'mouseup', this.reset );

};

/**
 * Check if some multiselection modifier key is pressed
 * 
 * @param {Object} event - The event object.
 * @return {Boolean} this.isMultiSelectKeyPressed
 */
isMultiSelectKeyPressed  ( event ) {

  this.multiSelectKeyPressed = false;

  for ( var index = 0; index < this.multiSelectKeys.length; index++ ) {
    var mKey = this.multiSelectKeys[index];
    if( event[mKey] ) { this.multiSelectKeyPressed = true; }
  }

  return this.multiSelectKeyPressed;

};

/**
 * Grabs the starting position of all needed elements
 * 
 * @param {Object} event - The event object.
 */
private getStartingPositions  ( event ) {

  this.initialCursorPos = this.getCursorPos( event, this.area );
  this.initialScroll = this.getScroll( this.area );

  var selectorPos = {};
  selectorPos.x = this.initialCursorPos.x + this.initialScroll.x;
  selectorPos.y = this.initialCursorPos.y + this.initialScroll.y;
  selectorPos.w = 0;
  selectorPos.h = 0;
  this.updatePos( this.selector, selectorPos );

};


// Movements/Sizing of selection
//////////////////////////////////////////////////////////////////////////////////////

/**
 * Handles what happens while the mouse is moved
 * 
 * @param {Object} event - The event object.
 */
private handleMove  ( event ) {

  var selectorPos = this.getPosition( event );

  // callback
  this.moveCallback( event );
  if( this.breaked ) { return false; }

  this.selector.style.display = 'block';  // hidden unless moved, fix for issue #8
  
  // move element on location
  this.updatePos( this.selector, selectorPos );
  this.checkIfInsideSelection();

  // scroll area if area is scrollable
  this.autoScroll( event );

};

/**
 * Calculates and returns the exact x,y w,h positions of the selector element
 * 
 * @param {Object} event - The event object.
 */
getPosition  ( event ) {

  var cursorPosNew = this.getCursorPos( event, this.area );
  var scrollNew = this.getScroll( this.area );

  // save for later retrieval
  this.newCursorPos = cursorPosNew;

  // if area or document is scrolled those values have to be included aswell
  var scrollAmount = {
    x: scrollNew.x - this.initialScroll.x,
    y: scrollNew.y - this.initialScroll.y
  };

  /** check for direction
   *
   * This is quite complicated math, so also quite complicated to explain. Lemme’ try:
   *
   * Problem #1:
   * Sadly in HTML we can not have negative sizes.
   * so if we want to scale our element 10px to the right then it is easy,
   * we just have to add +10px to the width. But if we want to scale the element
   * -10px to the left then things become more complicated, we have to move
   * the element -10px to the left on the x axis and also scale the element
   * by +10px width to fake a negative sizing.
   * 
   * One solution to this problem is using css-transforms scale() with
   * transform-origin of top left. BUT we can’t use this since it will size
   * everything, then when your element has a border for example, the border will
   * get inanely huge. Also transforms are not widely supported in IE.
   * 
   * Example #1:
   * Unfortunately, things get even more complicated when we are inside a scrollable
   * DIV. Then, let’s say we scoll to the right by 10px and move the cursor right by 5px in our
   * checks we have to substract 10px from the initialcursor position in our check
   * (since the inital position is moved to the left by 10px) so in our example:
   * 1. cursorPosNew.x (5) > initialCursorPos.x (0) - scrollAmount.x (10) === 5 > -10 === true
   * then reset the x position to its initial position (since we might have changed that
   * position when scrolling to the left before going right) in our example:
   * 2. selectorPos.x = initialCursorPos.x (0) + initialScroll.x (0) === 0;
   * then we cann calculate the elements width, which is
   * the new cursor position minus the initial one plus the scroll amount, so in our example:
   * 3. selectorPos.w = cursorPosNew.x (5) - initialCursorPos.x (0) + scrollAmount.x (10) === 15;
   * 
   * let’s say after that movement we now scroll 20px to the left and move our cursor by 30px to the left:
   * 1b. cursorPosNew.x (-30) > initialCursorPos.x (0) - scrollAmount.x (-20) === -30 > -20 === false;
   * 2b. selectorPos.x = cursorPosNew.x (-30) + scrollNew.x (-20)
   *                   === -50;  // move left position to cursor (for more info see Problem #1)
   * 3b. selectorPos.w = initialCursorPos.x (0) - cursorPosNew.x (-30) - scrollAmount.x (-20) 
   *                   === 0--30--20 === 0+30+20 === 50;  // scale width to original left position (for more info see Problem #1)
   * 
   * same thing has to be done for top/bottom
   * 
   * I hope that makes sence, try stuff out and play around with variables to get a hang of it.
   */
  var selectorPos = {};

  // right
  if( cursorPosNew.x > this.initialCursorPos.x - scrollAmount.x ) {  // 1.
    selectorPos.x = this.initialCursorPos.x + this.initialScroll.x;  // 2.
    selectorPos.w = cursorPosNew.x - this.initialCursorPos.x + scrollAmount.x;  // 3.
  // left
  } else {  // 1b.
    selectorPos.x = cursorPosNew.x + scrollNew.x;  // 2b.
    selectorPos.w = this.initialCursorPos.x - cursorPosNew.x - scrollAmount.x;  // 3b.
  }

  // bottom
  if( cursorPosNew.y > this.initialCursorPos.y - scrollAmount.y ) {
    selectorPos.y = this.initialCursorPos.y + this.initialScroll.y;
    selectorPos.h = cursorPosNew.y - this.initialCursorPos.y + scrollAmount.y;
  // top
  } else {
    selectorPos.y = cursorPosNew.y + scrollNew.y;
    selectorPos.h = this.initialCursorPos.y - cursorPosNew.y - scrollAmount.y;
  }

  return selectorPos;

};


// Colision detection
//////////////////////////////////////////////////////////////////////////////////////

/**
 * Checks if element is inside selection and takes action based on that
 * 
 * force handles first clicks and accessibility. Here is user is clicking directly onto
 * some element at start, (contrary to later hovers) we can assume that he
 * really wants to select/deselect that item.
 * 
 * @param {Boolean} force – forces through.
 * 
 * @return {Boolean}
 */
checkIfInsideSelection  ( force ) {

  var anyInside = false;

  for( var i = 0, il = this.selectables.length; i < il; i++ ) {

    var selectable = this.selectables[i];

    if( this.isElementTouching( selectable, this.selector, this.area ) ) {
      this.handleSelection( selectable, force );
      anyInside = true;
    } else {
      this.handleUnselection( selectable, force );
    }

  }

  return anyInside;

};

/**
 * Logic when an item is selected
 * 
 * @param {Node} item – selected item.
 * @param {Boolean} force – forces through.
 */
private handleSelection  ( item, force ) {

  if( this.hasClass( item, 'ds-hover' ) && !force ) { return false; }
  var posInSelectedArray = this.selected.indexOf( item );

  if( posInSelectedArray < 0 ) {
    this.select( item );
  } else if( posInSelectedArray > -1 && this.multiSelectKeyPressed ) {
    this.unselect( item );
  }

  this.addClass( item, 'ds-hover' );

};

/**
 * Logic when an item is de-selected
 * 
 * @param {Node} item – selected item.
 * @param {Boolean} force – forces through.
 */
private handleUnselection  ( item, force ) {

  if( !this.hasClass( item, 'ds-hover' ) && !force ) { return false; }
  var posInSelectedArray = this.selected.indexOf( item );

  if( posInSelectedArray > -1 && !this.multiSelectKeyPressed ) {
    this.unselect( item );
  }

  this.removeClass( item, 'ds-hover' );

};

/**
 * Adds an item to the selection.
 * 
 * @param {Node} item – item to select.
 * @return {Node} item
 */
select  ( item ) {

  if( this.selected.indexOf(item) > -1) { return false; }

  this.selected.push( item );
  this.addClass( item, 'ds-selected' );

  this.selectCallback( item );
  if( this.breaked ) { return false; }

  return item;

};

/**
 * Removes an item from the selection.
 * 
 * @param {Node} item – item to select.
 * @return {Node} item
 */
unselect  ( item ) {

  if( this.selected.indexOf(item) < 0) { return false; }

  this.selected.splice( this.selected.indexOf(item), 1 );
  this.removeClass( item, 'ds-selected' );
  
  this.unselectCallback( item );
  if( this.breaked ) { return false; }

  return item;

};

/**
 * Adds/Removes an item to the selection.
 * If it is already selected = remove, if not = add.
 * 
 * @param {Node} item – item to select.
 * @return {Node} item
 */
toggle  ( item ) {
  
    if( this.selected.indexOf( item ) > -1) {
      this.unselect( item );
    } else {
      this.select( item );
    }
  
    return item;
  
  };

/**
 * Checks if element is touched by the selector (and vice-versa)
 * 
 * @param {Node} element – item.
 * @param {Node} container – selector.
 * @param {Node} area – surrounding area.
 * @return {Boolean}
 */
isElementTouching  ( element, container, area ) {

  /**
   * calculating everything here on every move consumes more performance
   * but makes sure to get the right positions even if the containers are
   * resized or moved on the fly. This also makes the function kinda context independant.
   */
  var scroll = this.getScroll( area );

  var containerRect = {
    y: container.getBoundingClientRect().top + scroll.y,
    x: container.getBoundingClientRect().left + scroll.x,
    h: container.offsetHeight || element.getBoundingClientRect().height,
    w: container.offsetWidth || element.getBoundingClientRect().width
  };
  var elementRect = {
    y: element.getBoundingClientRect().top + scroll.y,
    x: element.getBoundingClientRect().left + scroll.x,
    h: element.offsetHeight || element.getBoundingClientRect().height,
    w: element.offsetWidth || element.getBoundingClientRect().width
  };

  // Axis-Aligned Bounding Box Colision Detection.
  // Imagine following Example:
  //    b01
  // a01[1]a02
  //    b02      b11
  //          a11[2]a12
  //             b12
  // to check if those two boxes collide we do this AABB calculation:
  //& a01 < a12 (left border pos box1 smaller than right border pos box2)
  //& a02 > a11 (right border pos box1 larger than left border pos box2)
  //& b01 < b12 (top border pos box1 smaller than bottom border pos box2)
  //& b02 > b11 (bottom border pos box1 larger than top border pos box2)
  // See: https://en.wikipedia.org/wiki/Minimum_bounding_box#Axis-aligned_minimum_bounding_box and https://developer.mozilla.org/en-US/docs/Games/Techniques/2D_collision_detection
  if (
    containerRect.x                   < elementRect.x + elementRect.w &&
    containerRect.x + containerRect.w > elementRect.x &&
    containerRect.y                   < elementRect.y + elementRect.h &&
    containerRect.h + containerRect.y > elementRect.y
  ) {
    return true; // collision detected!
  }
  else {
    return false;
  }

};


// Autoscroll
//////////////////////////////////////////////////////////////////////////////////////

/**
 * Automatically Scroll the area by selecting
 * 
 * @param {Object} event – event object.
 */
private autoScroll  ( event ) {

  var edge = this.isCursorNearEdge( event, this.area );

  var _area = this.area === document ? this.area.body : this.area;

  if( edge === 'top' && _area.scrollTop > 0 ) { _area.scrollTop -= 1 * this.autoScrollSpeed; }
  else if( edge === 'bottom' ) { _area.scrollTop += 1 * this.autoScrollSpeed; }
  else if( edge === 'left' && _area.scrollLeft > 0 ) { _area.scrollLeft -= 1 * this.autoScrollSpeed; }
  else if( edge === 'right' ) { _area.scrollLeft += 1 * this.autoScrollSpeed; }

};

/**
 * Check if the selector is near an edge of the area
 * 
 * @param {Object} event – event object.
 * @param {Node} area – the area.
 * @return {String} top / bottom / left / right / false
 */
isCursorNearEdge  ( event, area ) {

  var cursorPosition = this.getCursorPos( event, area );
  var areaRect = this.getAreaRect( area );

  var tolerance = {
    x: Math.max(areaRect.width / 10, 30),
    y: Math.max(areaRect.height / 10, 30)
  };

  if( cursorPosition.y < tolerance.y ) { return 'top'; }
  else if( areaRect.height - cursorPosition.y < tolerance.y ) { return 'bottom'; }
  else if( areaRect.width - cursorPosition.x < tolerance.x ) { return 'right'; }
  else if( cursorPosition.x < tolerance.x ) { return 'left'; }

  return false;

};


// Ending
//////////////////////////////////////////////////////////////////////////////////////

/**
 * Unbind functions when mouse click is released
 */
reset  ( event ) {
  
  this.area.removeEventListener( 'mousemove', this.handleMove );
  this.area.addEventListener( 'mousedown', this.startUp );

  this.callback( this.selected, event );
  if( this.breaked ) { return false; }

  this.selector.style.width = '0';
  this.selector.style.height = '0';
  this.selector.style.display = 'none';

  setTimeout(function() {  // debounce in order "onClick" to work
    this.mouseInteraction = false;
  }.bind(this), 100);

};

/**
 * Function break: used in callbacks to stop break the code at the specific moment
 * - Event listeners and calculation will continue working
 * - Selector won’t display and will not select
 */
break  () {

  this.breaked = true;
  setTimeout(function() {  // debounce the break should only break once instantly after call
    this.breaked = false;
  }.bind(this), 100);

};

/**
 * Complete function teardown
 */
stop  () {

  this.reset();
  this.area.removeEventListener( 'mousedown', this.startUp );
  this.area.removeEventListener( 'mouseup', this.reset );

};


// Usefull methods for user
//////////////////////////////////////////////////////////////////////////////////////

/**
 * Returns the current selected nodes
 * 
 * @return {Nodes}
 */
getSelection  () {

  return this.selected;

};

/**
 * Add nodes that can be selected.
 * The algorythm makes sure that no node is added twice
 * 
 * @param {Nodes} _nodes – dom nodes
 * @param {Nodes} addToSelection – if elements should also be added to current selection
 * @return {Nodes} _nodes – the added node(s)
 */
addSelectables  ( _nodes, addToSelection ) {

  var nodes = this.toArray( _nodes );
  this.handleSelectables( nodes, false, addToSelection );
  return _nodes;

};

/**
 * Gets all nodes that can be selected
 * 
 * @return {Nodes} this.selectables
 */
getSelectables  () {

  return this.selectables;

};

/**
 * Remove nodes from the nodes that can be selected.
 * 
 * @param {Nodes} _nodes – dom nodes
 * @param {Nodes} removeFromSelection – if elements should also be removed from current selection
 * @return {Nodes} _nodes – the removed node(s)
 */
removeSelectables  ( _nodes, removeFromSelection ) {

  var nodes = this.toArray( _nodes );
  this.handleSelectables( nodes, true, removeFromSelection );
  return _nodes;

};


// Helpers
//////////////////////////////////////////////////////////////////////////////////////

/**
 * Adds a class to an element
 * sadly legacy phones/browsers don’t support .classlist so we use this workaround
 * all credits to http://clubmate.fi/javascript-adding-and-removing-class-names-from-elements/
 * 
 * @param {Node} element 
 * @param {String} classname 
 * @return {Node} element
 */
addClass  ( element, classname ) {

  if(element.classList) { return element.classList.add(classname); }

  var cn = element.getAttribute('class') || '';
  if( cn.indexOf(classname) !== -1 ) { return element; }  // test for existance
  if( cn !== '' ) { classname = ' ' + classname; }  // add a space if the element already has class
  element.setAttribute('class', cn+classname);
  return element;

};

/**
 * Removes a class of an element
 * sadly legacy phones/browsers don’t support .classlist so we use this workaround
 * all credits to http://clubmate.fi/javascript-adding-and-removing-class-names-from-elements/
 * 
 * @param {Node} element 
 * @param {String} classname 
 * @return {Node} element
 */
removeClass  ( element, classname ) {

  if(element.classList) { return element.classList.remove(classname); }

  var cn = element.getAttribute('class') || '';
  var rxp = new RegExp( classname + '\\b', 'g' );
  cn = cn.replace( rxp, '' );
  element.setAttribute('class', cn);
  return element;

};

/**
 * Checks if an element has a class
 * sadly legacy phones/browsers don’t support .classlist so we use this workaround
 * 
 * @param {Node} element 
 * @param {String} classname 
 * @return {Boolean}
 */
hasClass  ( element, classname ) {

  if(element.classList) { return element.classList.contains(classname); }

  var cn = element.getAttribute('class') || '';
  if( cn.indexOf( classname ) > -1 ) { return true; }
  else { return false; }

};

/**
 * Transforms a nodelist or single node to an array
 * so user doesn’t have to care.
 * 
 * @param {Node} nodes
 * @return {array}
 */
toArray  ( nodes ) {

  if( !nodes ) { return false; }
  if( !nodes.length && this.isElement( nodes ) ) { return [nodes]; }

  var array = [];
  for ( var i = nodes.length - 1; i >= 0; i-- ) { 
    array[i] = nodes[i];
  }

  return array;

};

/**
 * Checks if a node is of type element
 * all credits to vikynandha: https://gist.github.com/vikynandha/6539809 
 * 
 * @param {Node} node
 * @return {Boolean}
 */
isElement  ( node ) {

  try {  // Using W3 DOM2 (works for FF, Opera and Chrome), also checking for SVGs
    return node instanceof HTMLElement || node instanceof SVGElement;
  }
  catch( e ){
    // Browsers not supporting W3 DOM2 don't have HTMLElement and
    // an exception is thrown and we end up here. Testing some
    // properties that all elements have. (works even on IE7)
    return ( typeof node === 'object' ) &&
            ( node.nodeType === 1 ) &&
            ( typeof node.style === 'object' ) &&
            ( typeof node.ownerDocument === 'object' );
  }

};

/**
 * Returns cursor x, y position based on event object
 * 
 * @param {Object} event
 * @param {Node} area – containing area / document if none
 * @return {Object} cursor X/Y
 */
getCursorPos  ( event, area ) {

  var cPos = {  // event.clientX/Y fallback for <IE8
    x: event.pageX || event.clientX,
    y: event.pageY || event.clientY
  };

  var areaRect = this.getAreaRect( area || document );
  var docScroll = this.getScroll();

  return {  // if it’s constrained in an area the area should be substracted calculate 
    x: cPos.x - areaRect.left - docScroll.x,
    y: cPos.y - areaRect.top - docScroll.y
  };

};

/**
 * Returns the starting/initial position of the cursor/selector
 * 
 * @return {Object} initialPos.
 */
getInitialCursorPosition  () {
    return this.initialCursorPos;
};

/**
 * Returns the starting/initial position of the cursor/selector
 * 
 * @return {Object} initialPos.
 */
getCurrentCursorPosition  () {
  return this.newCursorPos;
};

/**
 * Returns the cursor position difference between start and now
 * 
 * @return {Object} initialPos.
 */
getCursorPositionDifference  () {
  var initialPos = this.getInitialCursorPosition();
  var pos = this.getCurrentCursorPosition();

  var difference = {
    x: initialPos.x - pos.x,
    y: initialPos.y - pos.y
  };

  return difference;
};



/**
 * Returns the current x, y scroll value of a container
 * If container has no scroll it will return 0
 * 
 * @param {Node} area
 * @return {Object} scroll X/Y
 */
getScroll  ( area ) {

  var body = {
    top: document.body.scrollTop > 0 ? document.body.scrollTop : document.documentElement.scrollTop,
    left: document.body.scrollLeft > 0 ? document.body.scrollLeft : document.documentElement.scrollLeft
  };

  var scroll = {  // when the rectangle is bound to the document, no scroll is needed
    y: area && area.scrollTop >= 0 ? area.scrollTop : body.top,
    x: area && area.scrollLeft >= 0 ? area.scrollLeft : body.left
  };

  return scroll;

};

/**
 * Returns the top/left/bottom/right/width/height
 * values of a node. If Area is document then everything
 * except the sizes will be nulled.
 * 
 * @param {Node} area 
 * @return {Object}
 */
getAreaRect  ( area ) {

  if(area === document) {
    var size = {
      y: area.documentElement.clientHeight > 0 ? area.documentElement.clientHeight : window.innerHeight,
      x: area.documentElement.clientWidth > 0 ? area.documentElement.clientWidth : window.innerWidth
    };
    return { top: 0, left: 0, bottom: 0, right: 0, width: size.x, height: size.y };
  }

  return {
    top: area.getBoundingClientRect().top,
    left: area.getBoundingClientRect().left,
    bottom: area.getBoundingClientRect().bottom,
    right: area.getBoundingClientRect().right,
    width: area.offsetWidth,
    height: area.offsetHeight
  };

};

/**
 * Updates the node style left, top, width,
 * height values accordingly.
 * 
 * @param {Node} node
 * @param {Object} pos { x, y, w, h }
 * 
 * @return {Node}
 */
updatePos  ( node, pos ) {

  node.style.left = pos.x + 'px';
  node.style.top = pos.y + 'px';
  node.style.width = pos.w + 'px';
  node.style.height = pos.h + 'px';
  return node;

};


// Make exportable
//////////////////////////////////////////////////////////////////////////////////////
// jshint -W117

// Module exporting
if ( typeof module !== 'undefined' && module !== null ) {

  module.exports = DragSelect;

// AMD Modules
} else if( typeof define !== 'undefined' && typeof define === 'function' && define ) {

  define(function() { return DragSelect; });

} else {

  window.DragSelect = DragSelect;

}
}

