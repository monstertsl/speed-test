// === 全局变量定义 ===

let speedChart;            // Chart.js 图表实例
let maxSpeed = 0;          // 记录测试过程中的最大下载速度（MB/s）
let lossTestInterval;      // 用于丢包率测试的定时器 ID
let totalPackets = 0;      // 丢包测试中发送的总请求数
let lostPackets = 0;       // 丢包测试中失败的请求数
let dataPointCount = 0;    // 数据点计数器，用于生成 x 轴标签（1, 2, 3...）

// === 初始化图表函数 ===
function initChart() {
  // 如果已有图表实例存在，先销毁旧图表
  if (speedChart) {
    speedChart.destroy();
    speedChart = null;
  }

  // 重置数据点计数器
  dataPointCount = 0;

  // 获取 canvas 上下文
  const ctx = document.getElementById('speedChart').getContext('2d');

  // 创建新的 Chart 实例
  speedChart = new Chart(ctx, {
    type: 'line', // 折线图类型
    data: {
      labels: [], // 后续通过 push 添加空标签（不显示）
      datasets: [{
        label: '下载速度 (MB/s)',   // 图例名称
        data: [],                   // 初始为空，后续动态添加数据
        borderColor: 'rgba(75, 192, 192, 1)', // 线条颜色
        fill: false,                // 不填充区域
        tension: 1,               // 曲线平滑度
        pointRadius: 0,             // 🔥 隐藏所有数据点圆圈
        pointHoverRadius: 0         // 🔥 禁用鼠标悬停时的高亮圆圈
      }]
    },
    options: {
      responsive: true, // 自适应容器大小
      maintainAspectRatio: true, // 让 Chart.js 使用 canvas 的宽高比
      aspectRatio: 4, // 宽高比 4:1，与 CSS 的 aspect-ratio 保持一致
      animation: {
        duration: 0 // 🔥 禁用所有动画（图表不会从右侧“滑入”）
      },
      transitions: {
        active: {
          animation: {
            duration: 0
          }
        }
      },
      plugins: {
        legend: {
          display: false // 显示图例
        },
        tooltip: {
          enabled: true // 显示提示框
        }
      },
      scales: {
        x: {
          display: false // 🔥 完全隐藏整个 X 轴（无刻度、无标签、无网格线）
        },
        y: {
          beginAtZero: true,
          title: { 
            display: true, 
            text: '速度 (Mbp/s)' // Y 轴标题保留，方便理解数据
          }
        }
      }
    }
  });
}

// === 下载速度测试主函数 ===
async function startSpeedTest() {
  // 初始化图表
  initChart();
  maxSpeed = 0; // 重置最大速度
  const startTime = performance.now(); // 记录开始时间

  try {
    // 请求测试文件（确保该文件存在并被 Nginx 正确配置）
    const response = await fetch('/download/testfile.bin', { method: 'GET' });

    // 获取流式响应体的 reader
    const reader = response.body.getReader();
    let totalBytes = 0; // 已下载字节数

    while (true) {
      // 读取数据块
      const { done, value } = await reader.read();
      if (done) break;

      // 累加字节数
      totalBytes += value.length;

      // 计算已用时间（秒）和当前速度（MB/s）
      const elapsed = (performance.now() - startTime) / 1000;
      const speed = ((totalBytes * 8) / 1024 / 1024) / elapsed;

      // 更新图表和最大速度
      updateChart(speed);
    }
  } catch (err) {
    console.error('下载失败:', err);
  }
}

// === 图表更新函数 ===
function updateChart(speed) {
  // 如果当前速度大于历史最大值，更新最大速度
  if (speed > maxSpeed) {
    maxSpeed = speed;
  }

  // 在页面上实时显示当前最大速度
  document.getElementById('currentSpeed').textContent = maxSpeed.toFixed(2);

  // 使用递增整数作为 x 轴数据点（仅用于推进坐标轴，不显示）
  const label = ++dataPointCount;

  // 将新数据点添加到图表中
  speedChart.data.labels.push(label);         // 添加 x 轴数据点（不显示）
  speedChart.data.datasets[0].data.push(speed); // 添加 y 轴数据（速度值）
  speedChart.update();                        // 刷新图表
}

// === 延迟测试函数 ===
function testLatency() {
  // 记录请求开始时间
  const start = performance.now();

  // 发送请求到 /ping 接口
  fetch('/ping')
    .then(() => {
      // 计算延迟（毫秒）
      const latency = performance.now() - start;

      // 在页面上显示延迟结果
      document.getElementById('latency').textContent = latency.toFixed(1);
    })
    .catch(() => {
      // 请求失败时显示“失败”
      document.getElementById('latency').textContent = '失败';
    });
}

// === 丢包率测试函数（前端模拟） ===
function startLossTest() {
  // 重置计数器
  totalPackets = 0;
  lostPackets = 0;
  document.getElementById('packetLoss').textContent = '--';

  // 设置定时器，每 500ms 发送一次请求
  lossTestInterval = setInterval(() => {
    totalPackets++; // 总请求数加 1

    // 发送请求到 /ping 接口
    fetch('/ping')
      .then(res => {
        // 如果响应状态不是 200，则视为丢包
        if (!res.ok) {
          lostPackets++;
        }
      })
      .catch(() => {
        // 请求失败（如网络中断）也视为丢包
        lostPackets++;
      });

    // 发送 20 次请求后停止测试并计算丢包率
    if (totalPackets >= 20) {
      clearInterval(lossTestInterval);
      const lossRate = (lostPackets / totalPackets * 100).toFixed(1);
      document.getElementById('packetLoss').textContent = lossRate + '%';
    }
  }, 100); // 每 500ms 发送一次请求
}

// === 页面加载完成后初始化 ===
document.addEventListener('DOMContentLoaded', () => {
  // 初始化图表
  initChart();
});

// === 一个按钮触发三项测试 ===
function startAllTests() {
  // 重置所有状态
  document.getElementById('currentSpeed').textContent = '--';
  document.getElementById('latency').textContent = '--';
  document.getElementById('packetLoss').textContent = '--';

  if (lossTestInterval) {
    clearInterval(lossTestInterval);
  }

  // 并行执行三个测试
  startSpeedTest();
  testLatency();
  startLossTest();
}