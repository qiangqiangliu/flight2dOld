<template>
  <!--<button class="uk-button uk-button-primary uk-align-right" @click="openDialog"> Config  <i class="uk-icon-cog"></i>-->
  <!--</button>-->
    <span class="comps-title"><b>ISOMap View</b></span>
    <div class="uk-width-1-1 uk-flex uk-flex-wrap">
      <!--<span class="tip-title" v-if="selectedHour"> Current Time: </span>  <b class="label-color">{{selectedHour}}</b>-->
      <span class="tip-title" v-if="factory"> Factory: </span>  <b class="label-color">{{factory}}</b>
      <span class="tip-title" v-if="selectedChemical"> chemical: <b :style="{color: colorMap[selectedChemical][1]}">{{selectedChemical}}</b></span>
    <template class="uk-width-1-1" v-if="selectedHour">
      <span class="tip-title">Show ISOMap: </span> <input type="checkbox" v-model="showISO">
      <span class="tip-title">Hours before and after: </span> <input type="number" v-model="timeBeforeAndAfter">
      <span class="tip-title">Snapshot </span><button @click="addSnapShot"><i class="uk-icon-camera"></i></button>
    </template>
    </div>
  <div class="uk-width-1-1 chart-container uk-flex">
    <div class="chart" v-el:chart></div>
    <div class="snap-list">
      <div class="uk-thumbnail" v-for="snap in snapList">
        <i class="uk-icon-close uk-align-right" @click="removeSnap(snap)"></i>
        <img :src="snap.src" alt="">
        <div class="uk-thumbnail-caption"><span :style="{color: colorMap[snap.chemical][1]}">{{snap.chemical}}</span><br>{{snap.time}}</div>
      </div>
    </div>
  </div>
  <dialog v-ref:menu>
    <div slot="title">Config Panel</div>
    <div slot="body">
      <div class="uk-width-1-1">
        <span>Factory</span>
        <button v-for="op in factoryOpts"
                class="uk-button"
                :class="{'uk-button-primary': op===selectedFactory}"
                @click="switchFactory(op)">
          {{op}}
        </button>
      </div>
      <div class="uk-width-1-1">
        <span>Time before and after</span>
        <input type="number" v-model="timeBeforeAndAfter">
      </div>
      <div class="uk-width-1-1">
        <span>Show ISOMap Layer</span>
        <input type="checkbox" v-model="showISO">
      </div>
      <br>
      <button class="uk-button uk-button-success uk-align-right" @click="configConfirm"> Confirm </button>
    </div>
  </dialog>
</template>
<script>
  import {selectedBar, factory, windToken, chemicalToken, timeToken, selectedChemical, selectedHour} from '../vuex/getters'
  import {switchFactory} from '../vuex/actions'
  import Dialog from './Dialog.vue'
  import storage from '../commons/storage'
  import config from '../commons/config'
  import ISOMap from '../charts/ISOMap'
  import {formatFunc} from '../commons/utils'
  import InterWk from './interploration.worker'
  import $ from 'jquery'
  let { sensorsLoc, factoriesLoc, sensorOpts, factoryOpts, colorMap } = config
  let windData = null
  let sensorData = null
  let sensorsLoc2 = JSON.parse(JSON.stringify(sensorsLoc))
  const getAngle = (s, t) => {
    let a = Math.abs(Math.atan((t[ 1 ] - s[ 1 ]) / (t[ 0 ] - s[ 0 ])))
    if (s[ 0 ] < t[ 0 ]) {
      if (s[ 1 ] < t[ 1 ]) {
        a += Math.PI * 0.5
      } else {
        a = Math.PI / 2 - a
      }
    } else {
      if (s[ 1 ] > t[ 1 ]) {
        a = Math.PI * 3 / 2 + a
      } else {
        a = Math.PI * 3 / 2 - a
      }
    }
    return a
  }

  const getDist = (s, t) => {
    return Math.sqrt(Math.pow(s[ 0 ] - t[ 0 ], 2) + Math.pow(s[ 1 ] - t[ 1 ], 2))
  }

  export default {
    components: {Dialog},
    vuex: {
      getters: { selectedBar, factory, windToken, chemicalToken, timeToken, selectedChemical, selectedHour },
      actions: {switchFactory}
    },
    watch: {
      windToken () {
        if (this.windToken) windData = storage.get(this.windToken)
      },
      timeToken () {
        if (this.timeToken) sensorData = storage.get(this.timeToken)
      },
      selectedBar: {
        deep: true,
        handler () {
          this.update()
        }
      },
      updateStr () {
        this.update()
      },
      factory () {
        this.chartIns && this.chartIns.highlightFactory(this.factory)
      },
      selectedHour () {
        this.chartIns.clearISOLine()
        this.update()
      }
    },
    computed: {
      updateStr () {
        return this.selectedChemical + this.factory + this.timeBeforeAndAfter + this.showISO
      }
    },
    data () {
      return {
        colorMap,
        timeBeforeAndAfter: 5,
        factoryOpts,
        chartIns: null,
        playData: {},
        factorySensorAngle: {},
        factorySenorDist: {},
        playId: null,
        selectedFactory: null,
        showISO: true,
        snapList: []
      }
    },
    methods: {
      removeSnap (snap) {
        this.snapList.$remove(snap)
      },
      addSnapShot () {
        this.$nextTick(() => {
          this.chartIns && this.chartIns.getDataURI(this.addToSnapList)
        })
      },
      addToSnapList (dataUri) {
        this.snapList.push({src: dataUri, time: this.selectedHour, chemical: this.selectedChemical})
      },
      configConfirm () {
//        this.update()
        this.$refs.menu.close()
      },
      openDialog () {
        this.$refs.menu.show()
      },
      update () {
        // todo 处理数据 画图
        this.processData()
        this.drawISO()
      },
      drawISO () {
        let chemical = this.selectedChemical
        let currentTime = this.selectedHour
        let windMap = this.windMap
        if (sensorData[ currentTime ]) {
          let playSensor = sensorData[ currentTime ][ chemical ]
          // 绘制时序图
          // changed 201707161322
          this.chartIns
            .drawPeriodLine({factory: this.factory, chemical, current: currentTime, periodData: this.periodData})
          // ISO
          if (this.showISO) {
            let worker = new InterWk()
            let width = $(this.$els.chart).width()
            let height = $(this.$els.chart).height()
            worker.postMessage({
              sensorsLoc: sensorsLoc2,
              sensorData: playSensor,
              scale: 7,
              width,
              height
            })
            worker.onmessage = (evt) => {
              let evtData = evt.data
              let {points, posData, domain, contours} = evtData
              points
              posData
              domain
//              this.chartIns.drawISOLine1({ points, posData, domain })
              this.chartIns.drawISOLine2({ contours, chemical })
            }
          } else {
            this.chartIns.clearISOLine()
          }
        } else {
          this.chartIns.clearPeriodLine()
        }

        // 风向图
        if (windMap[ currentTime ]) {
          this.chartIns.drawWind(windMap[ currentTime ])
        } else {
          this.chartIns.clearWind()
        }
      },
      processData () {
        let windMap = {}
        windData.forEach((d) => {
          if (!windMap[ d.date ]) {
            windMap[ d.date ] = {
              speed: d.speed,
              direction: d.direction
            }
          }
        })
        this.windMap = windMap

        let chemical = this.selectedChemical
        let currentTime = this.selectedHour

        // step 1 构造当前时刻前后数据 periodData {sensor: {time: value}},eg: {S1: {4/2/2016 1:00: 0.34}}
        let oneHour = 1000 * 60 * 60
        let currentTimeStamp = +new Date(currentTime)
        let timeArr = [currentTime]
        for (let i = 0; i < this.timeBeforeAndAfter; i++) {
          timeArr.push(formatFunc(new Date(currentTimeStamp - oneHour * (i + 1))))
          timeArr.push(formatFunc(new Date(currentTimeStamp + oneHour * (i + 1))))
        }
        timeArr.sort((a, b) => new Date(a) - new Date(b))
        let periodData = {}
        let periodWind = {}
        sensorOpts.forEach((d) => {
          periodData[d] = {}
        })
        let domain = {max: 0, min: 1000}
        timeArr.forEach((t) => {
          // 如果数据中有该时刻
          if (sensorData[t]) {
            let sensorD = sensorData[t][chemical]
            sensorOpts.forEach((s) => {
              let v = sensorD ? sensorD[s] || 0 : 0
              periodData[s][t] = v
              domain.max = Math.max(v, domain.max)
              domain.min = Math.min(v, domain.min)
            })
          } else {
            // 如果没有就置为0
            sensorOpts.forEach((s) => {
              periodData[s][t] = 0
            })
          }

          if (windMap[t]) {
            periodWind[t] = windMap[t]
          }
        })
        this.periodData = {
          data: periodData,
          domain,
          periodWind
        }
      },
      getAnglesAndDist () {
        let axisAngle = {}
        let distMap = {}
        Object.keys(factoriesLoc).forEach((f) => {
          axisAngle[ f ] = {}
          distMap[ f ] = {}
          Object.keys(sensorsLoc).forEach((s) => {
            axisAngle[ f ][ s ] = getAngle(factoriesLoc[ f ], sensorsLoc[ s ])
            distMap[ f ][ s ] = getDist(factoriesLoc[ f ], sensorsLoc[ s ])
          })
        })
        this.factorySensorAngle = axisAngle
        this.factorySenorDist = distMap
      }
    },
    created () {
      // 计算角度和距离
      this.getAnglesAndDist()
    },
    ready () {
      this.chartIns = new ISOMap(this.$els.chart)
      this.chartIns.on('clickFactory', this.switchFactory)
    }
  }
</script>
<style lang="less" scoped>
  @import "../commons/base.vars.less";
  @snap-width: 150px;
  i {
    color: @color-main;
  }
  .chart-container {
    height: calc(~"100% - 50px");
  }
  .chart {
    height: calc(~"100% - 40px");
    width: calc(~"100% - "@snap-width);
  }
  .snap-list {
    width: @snap-width;
    height: calc(~"100% - 40px");
    overflow-y: scroll;
  }
  .tip-title {
    /*font-weight: bold;*/
    margin-left: 10px;
    margin-right: 2px;
  }
  input[type="number"] {
    width: 30px;
  }
</style>
