/* global Image */

import d3 from 'd3'
const heatmap = require('./lib/heatmapcore/heatmapcore')

module.exports = function (element, width, height, stateChangedCallback) {
  const instance = {
    lastTheme: null,
    lastValue: null
  }

  // Need dedicated helper function that can be called by both renderValue
  // and resize. resize can't call this.renderValue because that will be
  // routed to the Shiny wrapper method from htmlwidgets, which expects the
  // wrapper data object, not x.
  function doRenderValue (x) {
    var self = this

    instance.lastValue = x

    if (instance.lastTheme && instance.lastTheme !== x.theme) {
      d3.select(document.body).classed('theme-' + instance.lastTheme, false)
    }
    if (x.theme) {
      d3.select(document.body).classed('theme-' + x.theme, true)
    }

    element.innerHTML = ''
    d3.select(document.body).select('.rhtmlHeatmap-tip').remove()

    loadImage(x.image, function (imgData, w, h) {
      if (w !== x.matrix.dim[0] || h !== x.matrix.dim[1]) {
        throw new Error('Color dimensions didn\'t match data dimensions')
      }

      var merged = []
      for (var i = 0; i < x.matrix.data.length; i++) {
        var r = imgData[i * 4]
        var g = imgData[i * 4 + 1]
        var b = imgData[i * 4 + 2]
        var a = imgData[i * 4 + 3]
        // calculate color contrast
        // http://stackoverflow.com/questions/11867545/change-text-color-based-on-brightness-of-the-covered-background-area
        var o = Math.round(((r * 299) + (g * 587) + (b * 114)) / 1000)
        var cellnoteColor
        var hide = 0
        var color = 'rgba(' + [r, g, b, a / 255].join(',') + ')'
        if (x.matrix.cells_to_hide[i] !== 0) {
          hide = 1
          cellnoteColor = 'transparent'
        } else {
          if (x.options.shownote_in_cell) {
            if (x.matrix.cellnote_in_cell[i] === 'No data') {
              cellnoteColor = 'transparent'
            } else {
              if (a === 0) {
                cellnoteColor = 'black'
              } else {
                cellnoteColor = (o > 125) ? 'black' : 'white'
              }
            }
          } else {
            cellnoteColor = 'transparent'
          }
        }
        merged.push({
          label: x.matrix.data[i],
          color: color,
          cellnote_in_cell: x.matrix.cellnote_in_cell[i],
          cellnote_color: cellnoteColor,
          hide: hide
        })
      }
      x.matrix.merged = merged
      // console.log(JSON.stringify({merged: x.matrix.merged}, null, "  "));

      var hm = heatmap(element, x, x.options)
      if (window.Shiny) {
        var id = self.getId(element)
        hm.on('hover', function (e) {
          console.log('foo')
          window.Shiny.onInputChange(id + '_hover', !e.data ? e.data : {
            label: e.data.label,
            row: x.matrix.rows[e.data.row],
            col: x.matrix.cols[e.data.col]
          })
        })
        /* heatmap doesn't currently send click, since it means zoom-out
         hm.on('click', function(e) {
         Shiny.onInputChange(id + '_click', !e.data ? e.data : {
         label: e.data.label,
         row: e.data.row + 1,
         col: e.data.col + 1
         });
         });
         */
      }
    })
  }

  function loadImage (uri, callback) {
    var img = new Image()
    img.onload = function () {
      // Save size
      const w = img.width
      const h = img.height

      // Create a dummy canvas to extract the image data
      var imgDataCanvas = document.createElement('canvas')
      imgDataCanvas.width = w
      imgDataCanvas.height = h
      imgDataCanvas.style.display = 'none'
      document.body.appendChild(imgDataCanvas)

      var imgDataCtx = imgDataCanvas.getContext('2d')
      imgDataCtx.drawImage(img, 0, 0)

      // Save the image data.
      const imgData = imgDataCtx.getImageData(0, 0, w, h).data

      // Done with the canvas, remove it from the page so it can be gc'd.
      document.body.removeChild(imgDataCanvas)

      callback(imgData, w, h)
    }
    img.src = uri
  }

  return {
    renderValue (incomingConfig, userState) {
      doRenderValue(incomingConfig)
    },

    resize (newWidth, newHeight) {
      if (instance.lastValue) {
        doRenderValue(instance.lastValue)
      }
    }
  }
}
