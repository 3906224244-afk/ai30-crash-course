/**
 * grain-field — 纸张纹理叠加层（从暗色粒子改造成纸纹）
 *
 * 属性：
 *   density  — 纹理密度 (0.0~1.0, 默认 0.3)
 *   speed    — 忽略（纸纹不需要动画，保留兼容）
 *   darkBg   — 背景色 (默认 #FDFBF7 奶油纸色)
 */

var SYSTEM_INFO = null;
function getSystemInfo() {
  if (!SYSTEM_INFO) SYSTEM_INFO = wx.getSystemInfoSync();
  return SYSTEM_INFO;
}

Component({
  properties: {
    density: { type: Number, value: 0.3 },
    speed: { type: Number, value: 0 },
    darkBg: { type: String, value: '#FDFBF7' }
  },

  data: { _inited: false },

  lifetimes: {
    attached() {
      this._initCanvas();
    },
    detached() {
      this._stop();
    }
  },

  pageLifetimes: {
    show() {
      if (this.data._inited) this._drawOnce();
    },
    hide() {
      this._stop();
    }
  },

  methods: {
    _initCanvas() {
      var that = this;
      var query = this.createSelectorQuery();
      query.select('#gf-canvas').fields({ node: true, size: true }).exec(function (res) {
        if (!res || !res[0] || !res[0].node) return;

        var canvas = res[0].node;
        var ctx = canvas.getContext('2d');
        var dpr = getSystemInfo().pixelRatio || 2;
        var w = res[0].width;
        var h = res[0].height;

        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);

        that._canvas = canvas;
        that._ctx = ctx;
        that._w = w;
        that._h = h;

        that._drawOnce();
      });
    },

    _generate() {
      var w = this._w;
      var h = this._h;
      var density = this.properties.density;

      // 纸张纹理粒子——极细、极淡
      var count = Math.floor((w * h) / 2500 * density);
      count = Math.max(60, Math.min(200, count));

      var particles = [];

      for (var i = 0; i < count; i++) {
        // 暖灰到微米色微粒
        var r = Math.random();
        var color;
        if (r < 0.6) {
          // 60% 极淡暖灰
          var b1 = Math.floor(210 + Math.random() * 35);
          color = 'rgb(' + b1 + ',' + Math.floor(b1*0.97) + ',' + Math.floor(b1*0.93) + ')';
        } else if (r < 0.85) {
          // 25% 微米色
          var b2 = Math.floor(195 + Math.random() * 30);
          color = 'rgb(' + b2 + ',' + Math.floor(b2*0.95) + ',' + Math.floor(b2*0.85) + ')';
        } else {
          // 15% 极淡纤维白
          var b3 = Math.floor(230 + Math.random() * 25);
          color = 'rgb(' + b3 + ',' + b3 + ',' + Math.floor(b3*0.96) + ')';
        }

        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          size: 0.4 + Math.random() * 1.6,
          opacity: 0.08 + Math.random() * 0.18,
          color: color
        });
      }

      this._particles = particles;
    },

    _drawOnce() {
      if (!this._canvas) return;
      if (!this._particles) this._generate();

      var ctx = this._ctx;
      var w = this._w;
      var h = this._h;
      var particles = this._particles;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = this.properties.darkBg;
      ctx.fillRect(0, 0, w, h);

      if (!particles) return;

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    },

    _start() {},
    _stop() {},
    _tick() {}
  }
});
