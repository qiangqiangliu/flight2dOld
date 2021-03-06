/**
 * Created by huangwei on 2017/6/26.
 */
import d3 from 'd3'
import $ from 'jquery'
import config from '../commons/config'
let {currentTime, dangerColor} = config
export default class {
  constructor (el) {
    this.el = el
    this.height = -1
    this.width = -1
    this.margin = {}
    this.axisXScale = null
    this.axisYScale = null
    this.data = null
    this.init()
  }

  init () {
    d3.select(this.el).selectAll('svg')
      .remove()
    this.svg = d3.select(this.el).append('svg')
      .attr('width', '100%')
      .attr('height', '100%')

    this.width = $(this.el).width()
    this.height = $(this.el).height()

    this.margin = {
      top: 10,
      bottom: 10,
      left: 0,
      right: 0
    }
    return this
  }

  draw (data, month, allData = null, sensor = null) {
    console.log('drdrdrdrdrdrdrdrdrdrdrddrdrdrdr')
    let width = this.width - this.margin.left - this.margin.right
    let height = this.height - this.margin.top - this.margin.bottom
    // this.svg.attr('height', height) // ?
    this.svg.selectAll('g').remove()
    this.data = data

    this.axisXScale = d3.time.scale()
      .rangeRound([0, width])
      .domain([new Date(month + '/1/2016 0:00'),
        month < 12 ? new Date((month + 1) + '/1/2016 0:00')
        : new Date('1/1/2017 0:00')])

    this.axisYScale = d3.scale.linear()
      .rangeRound([0, height])
      .domain([100, 0])

    this.update()

    if (allData && sensor) {
      this.drawThresholdLine(allData, sensor)
    }

    // console.log('before linechart')
  }
  clearCurrent () {
    this.svg.selectAll('.highlight').remove()
    return this
  }
  highlightCurrent (time) {
    console.log('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', this.axisXScale(new Date(time)))
    this.clearCurrent()
    this.svg.select('.areadiff')
      .append('line')
      .attr('x1', this.axisXScale(new Date(time)))
      .attr('x2', this.axisXScale(new Date(time)))
      .attr('y2', this.height - this.margin.top - this.margin.bottom)
      .attr('y1', 0)
      .attr('stroke', currentTime.color)
      .attr('stroke-width', currentTime.width)
      .attr('pointer-events', 'none')
      .attr('class', 'highlight')
    return this
  }
  update () {
    // console.log('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    let data = this.data
    this.svg.selectAll('.areadiff').remove()
    let g = this.svg.append('g')
      .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')')
      .attr('class', 'areadiff')
    let area = d3.svg.area()
      .x(d => this.axisXScale(new Date(d.x)))
      .y1(d => this.axisYScale(d.y))
      .y0(this.axisYScale(0))

    g.append('path')
      .datum(data)
      .attr('fill', 'steelblue')
      .attr('d', area)
  }
  drawThresholdLine (allData, sensor) {
    // 假设allData经过处理，只包含相同chemical，超过阈值的数据，包含传感器信息
    this.svg.selectAll('.threshold-line')
      .remove()
    this.svg.selectAll('.threshold-line')
      .data(allData)
      .enter()
      .append('line')
      .attr('x1', d => this.axisXScale(new Date(d.time)))
      .attr('x2', d => this.axisXScale(new Date(d.time)))
      .attr('y2', this.height)
      .attr('y1', 0)
      .attr('stroke', d => d.sensor === sensor ? dangerColor : 'green')
      .attr('stroke-width', 1) // ?
      .attr('pointer-events', 'none')
      .attr('class', 'threshold-line')
    return this
  }
  on (eventsMap) {
    if (eventsMap.hasOwnProperty('updateThreshold')) this.updateThreshold = eventsMap.updateThreshold
    return this
  }
}
