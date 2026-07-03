/**
 * 网格布局计算工具
 */

// 计算网格中每个格子的位置
function calculateGridPositions(gridSize, containerX, containerY, containerWidth, gap) {
  const cellSize = (containerWidth - gap * (gridSize - 1)) / gridSize
  const positions = []
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      positions.push({
        x: containerX + col * (cellSize + gap),
        y: containerY + row * (cellSize + gap),
        width: cellSize,
        height: cellSize,
        row,
        col,
        index: row * gridSize + col
      })
    }
  }
  return { positions, cellSize }
}

// 根据触摸坐标查找命中的格子
function hitTestGrid(touchX, touchY, positions) {
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i]
    if (touchX >= p.x && touchX <= p.x + p.width &&
        touchY >= p.y && touchY <= p.y + p.height) {
      return i
    }
  }
  return -1
}

module.exports = {
  calculateGridPositions,
  hitTestGrid
}
