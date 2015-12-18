'use strict';

var define = require( '../define' );
var is = require( '../is' );
var util = require( '../util' );
var fn, elesfn;

fn = elesfn = ({

  position: define.data( {
    field: 'position',
    bindingEvent: 'position',
    allowBinding: true,
    allowSetting: true,
    settingEvent: 'position',
    settingTriggersEvent: true,
    triggerFnName: 'rtrigger',
    allowGetting: true,
    validKeys: [ 'x', 'y' ],
    onSet: function( eles ){
      var updatedEles = eles.updateCompoundBounds();
      updatedEles.rtrigger( 'position' );
    },
    canSet: function( ele ){
      return !ele.locked() && !ele.isParent();
    }
  } ),

  // position but no notification to renderer
  silentPosition: define.data( {
    field: 'position',
    bindingEvent: 'position',
    allowBinding: false,
    allowSetting: true,
    settingEvent: 'position',
    settingTriggersEvent: false,
    triggerFnName: 'trigger',
    allowGetting: true,
    validKeys: [ 'x', 'y' ],
    onSet: function( eles ){
      eles.updateCompoundBounds();
    },
    canSet: function( ele ){
      return !ele.locked() && !ele.isParent();
    }
  } ),

  positions: function( pos, silent ){
    if( is.plainObject( pos ) ){
      this.position( pos );

    } else if( is.fn( pos ) ){
      var fn = pos;

      for( var i = 0; i < this.length; i++ ){
        var ele = this[ i ];

        var pos = fn.apply( ele, [ i, ele ] );

        if( pos && !ele.locked() && !ele.isParent() ){
          var elePos = ele._private.position;
          elePos.x = pos.x;
          elePos.y = pos.y;
        }
      }

      var updatedEles = this.updateCompoundBounds();
      var toTrigger = updatedEles.length > 0 ? this.add( updatedEles ) : this;

      if( silent ){
        toTrigger.trigger( 'position' );
      } else {
        toTrigger.rtrigger( 'position' );
      }
    }

    return this; // chaining
  },

  silentPositions: function( pos ){
    return this.positions( pos, true );
  },

  // get/set the rendered (i.e. on screen) positon of the element
  renderedPosition: function( dim, val ){
    var ele = this[0];
    var cy = this.cy();
    var zoom = cy.zoom();
    var pan = cy.pan();
    var rpos = is.plainObject( dim ) ? dim : undefined;
    var setting = rpos !== undefined || ( val !== undefined && is.string( dim ) );

    if( ele && ele.isNode() ){ // must have an element and must be a node to return position
      if( setting ){
        for( var i = 0; i < this.length; i++ ){
          var ele = this[ i ];

          if( val !== undefined ){ // set one dimension
            ele._private.position[ dim ] = ( val - pan[ dim ] ) / zoom;
          } else if( rpos !== undefined ){ // set whole position
            ele._private.position = {
              x: ( rpos.x - pan.x ) / zoom,
              y: ( rpos.y - pan.y ) / zoom
            };
          }
        }

        this.rtrigger( 'position' );
      } else { // getting
        var pos = ele._private.position;
        rpos = {
          x: pos.x * zoom + pan.x,
          y: pos.y * zoom + pan.y
        };

        if( dim === undefined ){ // then return the whole rendered position
          return rpos;
        } else { // then return the specified dimension
          return rpos[ dim ];
        }
      }
    } else if( !setting ){
      return undefined; // for empty collection case
    }

    return this; // chaining
  },

  // get/set the position relative to the parent
  relativePosition: function( dim, val ){
    var ele = this[0];
    var cy = this.cy();
    var ppos = is.plainObject( dim ) ? dim : undefined;
    var setting = ppos !== undefined || ( val !== undefined && is.string( dim ) );
    var hasCompoundNodes = cy.hasCompoundNodes();

    if( ele && ele.isNode() ){ // must have an element and must be a node to return position
      if( setting ){
        for( var i = 0; i < this.length; i++ ){
          var ele = this[ i ];
          var parent = hasCompoundNodes ? ele.parent() : null;
          var hasParent = parent && parent.length > 0;
          var relativeToParent = hasParent;

          if( hasParent ){
            parent = parent[0];
          }

          var origin = relativeToParent ? parent._private.position : { x: 0, y: 0 };

          if( val !== undefined ){ // set one dimension
            ele._private.position[ dim ] = val + origin[ dim ];
          } else if( ppos !== undefined ){ // set whole position
            ele._private.position = {
              x: ppos.x + origin.x,
              y: ppos.y + origin.y
            };
          }
        }

        this.rtrigger( 'position' );

      } else { // getting
        var pos = ele._private.position;
        var parent = hasCompoundNodes ? ele.parent() : null;
        var hasParent = parent && parent.length > 0;
        var relativeToParent = hasParent;

        if( hasParent ){
          parent = parent[0];
        }

        var origin = relativeToParent ? parent._private.position : { x: 0, y: 0 };

        ppos = {
          x: pos.x - origin.x,
          y: pos.y - origin.y
        };

        if( dim === undefined ){ // then return the whole rendered position
          return ppos;
        } else { // then return the specified dimension
          return ppos[ dim ];
        }
      }
    } else if( !setting ){
      return undefined; // for empty collection case
    }

    return this; // chaining
  },

  renderedBoundingBox: function( options ){
    var bb = this.boundingBox( options );
    var cy = this.cy();
    var zoom = cy.zoom();
    var pan = cy.pan();

    var x1 = bb.x1 * zoom + pan.x;
    var x2 = bb.x2 * zoom + pan.x;
    var y1 = bb.y1 * zoom + pan.y;
    var y2 = bb.y2 * zoom + pan.y;

    return {
      x1: x1,
      x2: x2,
      y1: y1,
      y2: y2,
      w: x2 - x1,
      h: y2 - y1
    };
  },

  updateCompoundBounds: function(){
    var cy = this.cy();

    // save cycles for non compound graphs or when style disabled
    if( !cy.styleEnabled() || !cy.hasCompoundNodes() ){ return cy.collection(); }

    var updated = [];

    function update( parent ){
      var _p = parent._private;
      var children = parent.children();
      var style = _p.style;
      var includeLabels = style[ 'compound-sizing-wrt-labels' ].value === 'include';
      var bb = children.boundingBox( {
        includeLabels: includeLabels,

        // updating the compound bounds happens outside of the regular
        // cache cycle (i.e. before fired events)
        useCache: false
      } );
      var padding = {
        top: style[ 'padding-top' ].pfValue,
        bottom: style[ 'padding-bottom' ].pfValue,
        left: style[ 'padding-left' ].pfValue,
        right: style[ 'padding-right' ].pfValue
      };
      var pos = _p.position;
      var didUpdate = false;

      if( style[ 'width' ].value === 'auto' ){
        _p.autoWidth = bb.w;
        pos.x = (bb.x1 + bb.x2 - padding.left + padding.right) / 2;
        didUpdate = true;
      }

      if( style[ 'height' ].value === 'auto' ){
        _p.autoHeight = bb.h;
        pos.y = (bb.y1 + bb.y2 - padding.top + padding.bottom) / 2;
        didUpdate = true;
      }

      if( didUpdate ){
        updated.push( parent );
      }
    }

    // go up, level by level
    var eles = this.parent();
    while( eles.nonempty() ){

      // update each parent node in this level
      for( var i = 0; i < eles.length; i++ ){
        var ele = eles[ i ];

        update( ele );
      }

      // next level
      eles = eles.parent();
    }

    // return changed
    return this.spawn( updated );
  }
});

var noninf = function( x ){
  if( x === Infinity || x === -Infinity ){
    return 0;
  }

  return x;
};

var updateBounds = function( b, x1, y1, x2, y2 ){
  b.x1 = x1 < b.x1 ? x1 : b.x1;
  b.x2 = x2 > b.x2 ? x2 : b.x2;
  b.y1 = y1 < b.y1 ? y1 : b.y1;
  b.y2 = y2 > b.y2 ? y2 : b.y2;
};

var updateBoundsFromBox = function( b, b2 ){
  return updateBounds( b, b2.x1, b2.y1, b2.x2, b2.y2 );
};

var getLabelBounds = function( ele, prefix ){
  var prefixDash;

  if( prefix ){
    prefixDash = prefix + '-';
  } else {
    prefixDash = '';
  }

  var prefixedProperty = util.getPrefixedProperty.bind( util );

  var bounds = {
    x1: Infinity,
    y1: Infinity,
    x2: -Infinity,
    y2: -Infinity
  };

  var _p = ele._private;
  var style = _p.style;
  var rstyle = _p.rstyle;
  var label = style[ prefixDash + 'label' ].strValue;
  var fontSize = style[ 'font-size' ];
  var halign = style[ 'text-halign' ];
  var valign = style[ 'text-valign' ];
  var labelWidth = prefixedProperty( rstyle, 'labelWidth', prefix );
  var labelHeight = prefixedProperty( rstyle, 'labelHeight', prefix );
  var labelX = prefixedProperty( rstyle, 'labelX', prefix );
  var labelY = prefixedProperty( rstyle, 'labelY', prefix );
  var isEdge = ele.isEdge();
  var rotation = style[ prefixDash + 'text-rotation' ];

  if( label && fontSize && labelHeight != null && labelWidth != null && labelX != null && labelY != null && halign && valign ){
    var lh = labelHeight;
    var lw = labelWidth;
    var lx1, lx2, ly1, ly2;

    if( isEdge ){
      lx1 = labelX - lw / 2;
      lx2 = labelX + lw / 2;
      ly1 = labelY - lh / 2;
      ly2 = labelY + lh / 2;
    } else {
      switch( halign.value ){
        case 'left':
          lx1 = labelX - lw;
          lx2 = labelX;
          break;

        case 'center':
          lx1 = labelX - lw / 2;
          lx2 = labelX + lw / 2;
          break;

        case 'right':
          lx1 = labelX;
          lx2 = labelX + lw;
          break;
      }

      switch( valign.value ){
        case 'top':
          ly1 = labelY - lh;
          ly2 = labelY;
          break;

        case 'center':
          ly1 = labelY - lh / 2;
          ly2 = labelY + lh / 2;
          break;

        case 'bottom':
          ly1 = labelY;
          ly2 = labelY + lh;
          break;
      }
    }

    if( ( isEdge && rotation.strValue === 'autorotate' ) || ( rotation.pfValue != null && rotation.pfValue !== 0 ) ){
      var theta = prefixedProperty( _p.rscratch, 'labelAngle', prefix );
      var cos = Math.cos( theta );
      var sin = Math.sin( theta );

      var rotate = function( x, y ){
        x = x - labelX;
        y = y - labelY;

        return {
          x: x * cos - y * sin + labelX,
          y: x * sin + y * cos + labelY
        };
      };

      var px1y1 = rotate( lx1, ly1 );
      var px1y2 = rotate( lx1, ly2 );
      var px2y1 = rotate( lx2, ly1 );
      var px2y2 = rotate( lx2, ly2 );

      lx1 = Math.min( px1y1.x, px1y2.x, px2y1.x, px2y2.x );
      lx2 = Math.max( px1y1.x, px1y2.x, px2y1.x, px2y2.x );
      ly1 = Math.min( px1y1.y, px1y2.y, px2y1.y, px2y2.y );
      ly2 = Math.max( px1y1.y, px1y2.y, px2y1.y, px2y2.y );
    }

    updateBounds( bounds, lx1, ly1, lx2, ly2 );
  }

  return bounds;
};

// get the bounding box of the elements (in raw model position)
var boundingBoxImpl = function( ele, options ){
  var cy = ele._private.cy;
  var cy_p = cy._private;
  var styleEnabled = cy_p.styleEnabled;

  var bounds = {
    x1: Infinity,
    y1: Infinity,
    x2: -Infinity,
    y2: -Infinity
  };

  var _p = ele._private;
  var style = _p.style;
  var display = styleEnabled ? _p.style[ 'display' ].value : 'element';
  var isNode = ele.isNode();
  var isEdge = ele.isEdge();
  var ex1, ex2, ey1, ey2, x, y;
  var displayed = display !== 'none';

  if( displayed ){
    if( isNode && options.includeNodes ){
      var pos = _p.position;
      x = pos.x;
      y = pos.y;
      var w = ele.outerWidth();
      var halfW = w / 2;
      var h = ele.outerHeight();
      var halfH = h / 2;

      // handle node dimensions
      /////////////////////////

      ex1 = x - halfW;
      ex2 = x + halfW;
      ey1 = y - halfH;
      ey2 = y + halfH;

      updateBounds( bounds, ex1, ey1, ex2, ey2 );

    } else if( isEdge && options.includeEdges ){
      var n1 = _p.source;
      var n1_p = n1._private;
      var n1pos = n1_p.position;

      var n2 = _p.target;
      var n2_p = n2._private;
      var n2pos = n2_p.position;


      // handle edge dimensions (rough box estimate)
      //////////////////////////////////////////////

      var rstyle = _p.rstyle || {};
      var w = 0;
      var wHalf = 0;

      if( styleEnabled ){
        w = style[ 'width' ].pfValue;
        wHalf = w / 2;
      }

      ex1 = n1pos.x;
      ex2 = n2pos.x;
      ey1 = n1pos.y;
      ey2 = n2pos.y;

      if( ex1 > ex2 ){
        var temp = ex1;
        ex1 = ex2;
        ex2 = temp;
      }

      if( ey1 > ey2 ){
        var temp = ey1;
        ey1 = ey2;
        ey2 = temp;
      }

      // take into account edge width
      ex1 -= wHalf;
      ex2 += wHalf;
      ey1 -= wHalf;
      ey2 += wHalf;

      updateBounds( bounds, ex1, ey1, ex2, ey2 );

      // handle points along edge (sanity check)
      //////////////////////////////////////////

      if( styleEnabled ){
        var pts = rstyle.bezierPts || rstyle.linePts || [];

        for( var j = 0; j < pts.length; j++ ){
          var pt = pts[ j ];

          ex1 = pt.x - wHalf;
          ex2 = pt.x + wHalf;
          ey1 = pt.y - wHalf;
          ey2 = pt.y + wHalf;

          updateBounds( bounds, ex1, ey1, ex2, ey2 );
        }
      }

      // precise haystacks (sanity check)
      ///////////////////////////////////

      if( styleEnabled && style[ 'curve-style' ].strValue === 'haystack' ){
        var hpts = rstyle.haystackPts;

        ex1 = hpts[0].x;
        ey1 = hpts[0].y;
        ex2 = hpts[1].x;
        ey2 = hpts[1].y;

        if( ex1 > ex2 ){
          var temp = ex1;
          ex1 = ex2;
          ex2 = temp;
        }

        if( ey1 > ey2 ){
          var temp = ey1;
          ey1 = ey2;
          ey2 = temp;
        }

        updateBounds( bounds, ex1, ey1, ex2, ey2 );
      }

    } // edges


    // handle label dimensions
    //////////////////////////

    if( styleEnabled && options.includeLabels ){
      updateBoundsFromBox( bounds, getLabelBounds( ele ) );

      if( isEdge ){
        updateBoundsFromBox( bounds, getLabelBounds( ele, 'source' ) );
        updateBoundsFromBox( bounds, getLabelBounds( ele, 'target' ) );
      }
    } // style enabled for labels
  } // if displayed

  return bounds;
};

var cachedBoundingBoxImpl = function( ele, opts ){
  var _p = ele._private;
  var bb;

  if( !_p.bbCache || !opts.useCache ){
    bb = _p.bbCache = boundingBoxImpl( ele, opts );
  } else {
    bb = _p.bbCache;
  }

  return bb;
};

elesfn.boundingBox = function( options ){
  var bounds = {
    x1: Infinity,
    y1: Infinity,
    x2: -Infinity,
    y2: -Infinity
  };

  options = options || util.staticEmptyObject();

  var opts = {
    includeNodes: options.includeNodes === undefined ? true : options.includeNodes,
    includeEdges: options.includeEdges === undefined ? true : options.includeEdges,
    includeLabels: options.includeLabels === undefined ? true : options.includeLabels,
    useCache: options.useCache === undefined ? true : options.useCache
  };

  var eles = this;

  // recalculate projections etc
  var cy_p = eles.cy()._private;
  var styleEnabled = cy_p.styleEnabled;
  if( styleEnabled ){
    cy_p.renderer.recalculateRenderedStyle( eles.union( eles.parallelEdges() ), !opts.useCache );
  }

  for( var i = 0; i < eles.length; i++ ){
    var ele = eles[i];

    updateBoundsFromBox( bounds, cachedBoundingBoxImpl( ele, opts ) );
  }

  bounds.x1 = noninf( bounds.x1 );
  bounds.y1 = noninf( bounds.y1 );
  bounds.x2 = noninf( bounds.x2 );
  bounds.y2 = noninf( bounds.y2 );
  bounds.w = noninf( bounds.x2 - bounds.x1 );
  bounds.h = noninf( bounds.y2 - bounds.y1 );

  return bounds;
};

var defineDimFns = function( opts ){
  opts.uppercaseName = util.capitalize( opts.name );
  opts.autoName = 'auto' + opts.uppercaseName;
  opts.labelName = 'label' + opts.uppercaseName;
  opts.outerName = 'outer' + opts.uppercaseName;
  opts.uppercaseOuterName = util.capitalize( opts.outerName );

  fn[ opts.name ] = function dimImpl(){
    var ele = this[0];
    var _p = ele._private;
    var cy = _p.cy;
    var styleEnabled = cy._private.styleEnabled;

    if( ele ){
      if( styleEnabled ){
        var d = _p.style[ opts.name ];

        switch( d.strValue ){
          case 'auto':
            return _p[ opts.autoName ] || 0;
          case 'label':
            return _p.rstyle[ opts.labelName ] || 0;
          default:
            return d.pfValue;
        }
      } else {
        return 1;
      }
    }
  };

  fn[ 'outer' + opts.uppercaseName ] = function outerDimImpl(){
    var ele = this[0];
    var _p = ele._private;
    var cy = _p.cy;
    var styleEnabled = cy._private.styleEnabled;

    if( ele ){
      if( styleEnabled ){
        var style = _p.style;
        var dim = ele[ opts.name ]();
        var border = style[ 'border-width' ].pfValue;
        var padding = style[ opts.paddings[0] ].pfValue + style[ opts.paddings[1] ].pfValue;

        return dim + border + padding;
      } else {
        return 1;
      }
    }
  };

  fn[ 'rendered' + opts.uppercaseName ] = function renderedDimImpl(){
    var ele = this[0];

    if( ele ){
      var d = ele[ opts.name ]();
      return d * this.cy().zoom();
    }
  };

  fn[ 'rendered' + opts.uppercaseOuterName ] = function renderedOuterDimImpl(){
    var ele = this[0];

    if( ele ){
      var od = ele[ opts.outerName ]();
      return od * this.cy().zoom();
    }
  };
};

defineDimFns( {
  name: 'width',
  paddings: [ 'padding-left', 'padding-right' ]
} );

defineDimFns( {
  name: 'height',
  paddings: [ 'padding-top', 'padding-bottom' ]
} );

// aliases
fn.modelPosition = fn.point = fn.position;
fn.modelPositions = fn.points = fn.positions;
fn.renderedPoint = fn.renderedPosition;
fn.relativePoint = fn.relativePosition;
fn.boundingbox = fn.boundingBox;
fn.renderedBoundingbox = fn.renderedBoundingBox;

module.exports = elesfn;
