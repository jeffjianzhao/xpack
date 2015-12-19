/*

A greedy algorithm for circle packing by best satisfying node horizontal contraints
developed based on the orginal circle packing algorithm by Wang et al, 2006.

Copyright (c) 2015, Jian Zhao
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of the Jian Zhao nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL JIAN ZHAO BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

 */

// Define module using Universal Module Definition pattern
// https://github.com/umdjs/umd/blob/master/returnExports.js

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // Support AMD. Register as an anonymous module.
    // EDIT: List all dependencies in AMD style
    define([], factory);
  }
  else if (typeof exports === 'object') {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    // EDIT: Pass dependencies to factory function
    module.exports = factory();
  }
  else {
    // No AMD. Set module as a global variable
    // EDIT: Pass dependencies to factory function
    root.xpack = factory();
  }
}(this,
//EDIT: The dependencies are passed to this function
function (){
//---------------------------------------------------
// BEGIN code for this module
//---------------------------------------------------

// return module
return function() {
    //public variables///////////////////////////////////////////////////////////
    var xpos   = function(d){return d.x;};
    var radius = function(d){return d.r;};
    var score  = function(d){return d.score;};

    //private variables///////////////////////////////////////////////////////////
    var packBounds,
        packOutline,
        rect,
        outline;

    //public methods///////////////////////////////////////////////////////////
    function xpack(data, packscore) {
        if(data.length === 0)
            return {nodes:[], rect:{xMin:0, xMax:0, yMin:0, yMax:0}, outline:{up:[], down:[]}};

        var threshold = 0;
        if (typeof packscore != "undefined")
            threshold = packscore;

        // not packing nodes below the threshold
        data.filter(function(d) {return score(d) < threshold;})
            .forEach(function(d) {d.px = undefined; d.py = undefined;});

        // packing nodes above the threshold
        var nodes = data;
        if(data.length > 0 && score(data[0])!==null && score(data[0])!==undefined){
            nodes = data.filter(function(d) {return score(d) >= threshold;});
        }
        packBounds = [];
        packOutline = [];
        rect = {xMin : 0, yMin : 0, xMax : 0, yMax : 0};
        outline = {up:[], down:[]};

        if (nodes.length === 0){
            return {nodes:nodes, rect:rect, outline:outline};
        }

        var i;

        for (i = 0; i < nodes.length; i++) {
            nodes[i].x = xpos(nodes[i]);
            nodes[i].r = radius(nodes[i]);
            xpackLink(nodes[i]);
        }

        nodes.sort(function(a, b) {return a.x - b.x;});

        i = 0;
        n = 0;
        while (i < nodes.length) {
            packBounds.push({
                xMin : Infinity,
                yMin : Infinity,
                xMax : -Infinity,
                yMax : -Infinity
            });

            // pack this nodes group
            i = packNodes(nodes, i, n);

            // get the packing outline
            packOutline.push(nodes[i-1]);
            for (var p = nodes[i-1]._pack_next; p != nodes[i-1]; p = p._pack_next) {
                packOutline.push(p);
            }

            n++;
        }

        // compute the global bounds
        rect.xMin = Infinity;
        rect.xMax = -Infinity;
        rect.yMin = Infinity;
        rect.yMax = -Infinity;
        packBounds.forEach(function(bd) {
            rect.xMin = Math.min(rect.xMin, bd.xMin);
            rect.xMax = Math.max(rect.xMax, bd.xMax);
            rect.yMin = Math.min(rect.yMin, bd.yMin);
            rect.yMax = Math.max(rect.yMax, bd.yMax);
        });

        // compute the global outline
        packOutline.sort(function(a, b) {return a.px - b.px;});
        packOutline.forEach(function(p) {
            if (p.py < 0)
                outline.up.push(p);
            else if (p.py > 0)
                outline.down.push(p);
            else {
                outline.up.push(p);
                outline.down.push(p);
            }

        });

        nodes.forEach(xpackUnlink);
        return {nodes:nodes, rect:rect, outline:outline};
    }

    //private methods///////////////////////////////////////////////////////////
    function packNodes(nodes, start, n) {
        var bd = packBounds[n],
            a, b, c, i, j, k;

        if (nodes.length - start >= 1) {
            // the first node
            a = nodes[start];
            a.px = a.x;
            a.py = 0;
            bound(a, bd);

            if (nodes.length - start >= 2) {
                // the second node
                if (outside(nodes[start+1], bd))
                    return start + 1;

                b = nodes[start+1];
                b.px = a.x + a.r + b.r;
                b.py = 0;
                bound(b, bd);

                xpackInsert(a, b);

                if (nodes.length - start >= 3) {
                    // the third node
                    if (outside(nodes[start+2], bd))
                        return start + 2;

                    c = nodes[start+2];
                    xpackPlace(a, b, c);
                    bound(c, bd);

                    xpackInsert(a, c);
                    //a._pack_prev = c;
                    //xpackInsert(c, b);
                    //b = a._pack_next;

                    // iterate through the rest
                    var preiter = false;
                    for (i = start + 3; i < nodes.length; i++) {
                        if (!preiter) {
                            if (outside(nodes[i], bd))
                                return i;
                            a = xpackBestPlace(a, nodes[i]);
                            b = a._pack_next;
                        }

                        xpackPlace(a, b, c = nodes[i]);
                        // search for the closest intersection
                        var isect = 0, s1 = 1, s2 = 1;
                        for (j = b._pack_next; j !== b; j = j._pack_next, s1++) {
                            if (xpackIntersects(j, c)) {
                                isect = 1;
                                break;
                            }
                        }
                        if (isect == 1) {
                            for (k = a._pack_prev; k !== j._pack_prev; k = k._pack_prev, s2++) {
                                if (xpackIntersects(k, c)) {
                                    break;
                                }
                            }
                        }
                        // update front chain
                        if (isect) {
                            if (s1 < s2 || (s1 == s2 && b.r < a.r))
                                xpackSplice(a, b = j);
                            else
                                xpackSplice(a = k, b);
                            i--;
                            preiter = true;
                        } else {
                            xpackInsert(a, c);
                            b = c;
                            bound(c, bd);
                            preiter = false;
                        }
                    }
                }
            }
        }

        return nodes.length;

    }

    function bound(node, bd) {
        bd.xMin = Math.min(node.px - node.r, bd.xMin);
        bd.xMax = Math.max(node.px + node.r, bd.xMax);
        bd.yMin = Math.min(node.py - node.r, bd.yMin);
        bd.yMax = Math.max(node.py + node.r, bd.yMax);
    }

    function outside(node, bd) {
        return node.x + node.r < bd.xMin || node.x - node.r > bd.xMax;
    }

    function xpackBestPlace(startn, node) {
        var goodnodes = [];
        for(var p = startn._pack_next; p != startn; p = p._pack_next) {
            if (p.px + p.r < node.x - node.r || p.px - p.r > node.x + node.r)
                continue;
            goodnodes.push(p);
        }
        if (goodnodes.length === 0)
            return startn;
        goodnodes.sort(function(a, b) {return Math.abs(a.py) - Math.abs(b.py);});
        /*
        if (Math.abs(goodnodes[0]._pack_prev.py) < Math.abs(goodnodes[0]._pack_next.py))
            return goodnodes[0]._pack_prev;
        else
            return goodnodes[0];


        xpackPlace(goodnodes[0], goodnodes[0]._pack_next, node);
        var y = Math.abs(node.py);
        xpackPlace(goodnodes[0]._pack_prev, goodnodes[0], node);

        if (Math.abs(node.py) < y)
            return goodnodes[0]._pack_prev;
        else
            goodnodes[0];
        */
        return goodnodes[0];

    }

    function xpackInsert(a, b) {
        var c = a._pack_next;
        a._pack_next = b;
        b._pack_prev = a;
        b._pack_next = c;
        c._pack_prev = b;
    }

    function xpackPlace(a, b, c) {
        var db = a.r + c.r,
            dx = b.px - a.px,
            dy = b.py - a.py;
        if (db && (dx || dy)) {
            var da = b.r + c.r,
                dc = dx * dx + dy * dy;
            da *= da;
            db *= db;
            var x = 0.5 + (db - da) / (2 * dc),
                y = Math.sqrt(Math.max(0, 2 * da * (db + dc) - (db -= dc) * db - da * da)) / (2 * dc);
            c.px = a.px + x * dx + y * dy;
            c.py = a.py + x * dy - y * dx;
        } else {
            c.px = a.px + db;
            c.py = a.py;
        }
    }

    function xpackIntersects(a, b) {
        var dx = b.px - a.px, dy = b.py - a.py, dr = a.r + b.r;
        return 0.999 * dr * dr > dx * dx + dy * dy;
        // relative error within epsilon
    }

    function xpackSplice(a, b) {
        a._pack_next = b;
        b._pack_prev = a;
    }

    function xpackLink(node) {
        node._pack_next = node._pack_prev = node;
    }

    function xpackUnlink(node) {
        delete node._pack_next;
        delete node._pack_prev;
    }

    function functor(val){
        return (typeof val === "function") ? val : function(){ return val; };
    }

    //expose public variables///////////////////////////////////////////////////////////
    xpack.xpos = function(_) {
        if (!arguments.length) return xpos;
        xpos = functor(_);
        return xpack;
    };

    xpack.radius = function(_) {
        if (!arguments.length) return radius;
        radius = functor(_);
        return xpack;
    };

    xpack.score = function(_) {
        if (!arguments.length) return score;
        score = functor(_);
        return xpack;
    };

    //return the object///////////////////////////////////////////////////////////
    return xpack;
};

//---------------------------------------------------
// END code for this module
//---------------------------------------------------
}));