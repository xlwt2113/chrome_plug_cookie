let targetUrl = '';
let lastHeaders = null;
let monitoredTabId = null;
let isMonitoring = false;

// 更新扩展图标状态
function updateIconState(isActive) {
  const iconPath = isActive ? {
    16: "images/icon16_active.png",
    48: "images/icon48_active.png",
    128: "images/icon128_active.png"
  } : {
    16: "images/icon16.png",
    48: "images/icon48.png",
    128: "images/icon128.png"
  };
  
  chrome.action.setIcon({ path: iconPath });
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'setTargetUrl') {
    targetUrl = request.url;
    // 清除之前的headers
    lastHeaders = null;
    isMonitoring = true;
    
    // 更新图标状态
    updateIconState(true);
    
    // 获取当前活动标签页
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        monitoredTabId = tabs[0].id;
        // 通知popup监控已开始
        sendResponse({ 
          status: 'success',
          tabId: monitoredTabId
        });
      }
    });
    return true; // 保持消息通道开放
  } else if (request.action === 'getHeaders') {
    sendResponse({ headers: lastHeaders });
  } else if (request.action === 'getMonitoringStatus') {
    sendResponse({ 
      isMonitoring,
      targetUrl,
      lastHeaders
    });
  } else if (request.action === 'stopMonitoring') {
    isMonitoring = false;
    // 不再清除 targetUrl 和 lastHeaders
    monitoredTabId = null;
    updateIconState(false);
    sendResponse({ 
      status: 'success',
      lastHeaders // 返回最后的headers信息
    });
  }
});

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 只处理被监控的标签页
  if (isMonitoring && tabId === monitoredTabId && changeInfo.status === 'complete') {
    // 检查URL是否匹配
    if (tab.url && tab.url.includes(targetUrl)) {
      // 重置headers
      lastHeaders = null;
      // 通知popup页面已更新
      chrome.runtime.sendMessage({
        action: 'tabUpdated',
        url: tab.url
      }).catch(() => {
        // 忽略错误，因为popup可能已关闭
      });
    }
  }
});

// 获取指定URL的所有cookies
async function getCookiesForUrl(url) {
  try {
    const cookies = await chrome.cookies.getAll({ url });
    return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
  } catch (error) {
    console.error('Error getting cookies:', error);
    return '';
  }
}

// 监听网络请求
chrome.webRequest.onBeforeSendHeaders.addListener(
  async (details) => {
    // 只处理被监控标签页的请求
    if (isMonitoring && details.tabId === monitoredTabId) {
      console.log('Request URL:', details.url);
      console.log('Request Headers:', details.requestHeaders);
      
      // 获取请求头
      const contentType = details.requestHeaders.find(
        header => header.name.toLowerCase() === 'content-type'
      );
      
      if (contentType && contentType.value.includes('application/json;charset=UTF-8')) {
        // 获取cookies
        const cookieString = await getCookiesForUrl(details.url);
        
        if (cookieString) {
          // 创建包含所有headers的对象
          const allHeaders = {
            requestHeaders: details.requestHeaders,
            cookies: cookieString
          };
          
          // 保存所有headers
          lastHeaders = allHeaders;
          
          // 通知popup更新显示
          try {
            await chrome.runtime.sendMessage({
              action: 'headersUpdated',
              headers: allHeaders
            });
          } catch (error) {
            console.error('Error sending message:', error);
          }
        }
      }
    }
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders"]
); 