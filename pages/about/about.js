Page({
  data: {
    show: false
  },

  onLoad() {
    setTimeout(() => { this.setData({ show: true }) }, 100)
  }
})
