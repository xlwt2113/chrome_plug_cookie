document.addEventListener('DOMContentLoaded', function() {
  const targetUrlInput = document.getElementById('targetUrl');
  const startMonitorBtn = document.getElementById('startMonitor');
  const headersContent = document.getElementById('headersContent');

  // 从background.js获取当前监控状态
  chrome.runtime.sendMessage({ action: 'getMonitoringStatus' }, function(response) {
    if (response.isMonitoring) {
      targetUrlInput.value = response.targetUrl;
      startMonitorBtn.textContent = '停止监控';
      startMonitorBtn.classList.add('monitoring');
      if (response.lastHeaders) {
        headersContent.textContent = JSON.stringify(response.lastHeaders, null, 2);
      } else {
        headersContent.textContent = '正在监控中...\n等待符合条件的请求...';
      }
    } else if (response.lastHeaders) {
      // 即使不在监控状态，如果有历史数据也显示
      targetUrlInput.value = response.targetUrl;
      headersContent.textContent = JSON.stringify(response.lastHeaders, null, 2);
    }
  });

  // 开始/停止监控按钮点击事件
  startMonitorBtn.addEventListener('click', function() {
    if (startMonitorBtn.classList.contains('monitoring')) {
      // 停止监控
      chrome.runtime.sendMessage({ action: 'stopMonitoring' }, function(response) {
        if (response.status === 'success') {
          startMonitorBtn.textContent = '开始监控';
          startMonitorBtn.classList.remove('monitoring');
          // 不再清除显示的内容
          if (response.lastHeaders) {
            headersContent.textContent = JSON.stringify(response.lastHeaders, null, 2);
          }
        }
      });
    } else {
      // 开始监控
      const url = targetUrlInput.value.trim();
      if (url) {
        // 保存URL到storage
        chrome.storage.local.set({ targetUrl: url });
        
        // 通知background.js开始监控
        chrome.runtime.sendMessage({
          action: 'setTargetUrl',
          url: url
        }, function(response) {
          if (response.status === 'success') {
            startMonitorBtn.textContent = '停止监控';
            startMonitorBtn.classList.add('monitoring');
            headersContent.textContent = '正在监控中...\n等待符合条件的请求...';
          }
        });
      }
    }
  });

  // 监听来自background.js的headers更新消息
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'headersUpdated') {
      headersContent.textContent = JSON.stringify(request.headers, null, 2);
    } else if (request.action === 'tabUpdated') {
      headersContent.textContent = `页面已更新: ${request.url}\n等待符合条件的请求...`;
    }
  });
}); 