'use strict';

chrome.runtime.onInstalled.addListener(function() {
  chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
    chrome.declarativeContent.onPageChanged.addRules([{
      conditions: [new chrome.declarativeContent.PageStateMatcher({
        pageUrl: {hostEquals: 'buyertrade.taobao.com'},
      })
      ],
      actions: [new chrome.declarativeContent.ShowAction()]
    }]);
  });
});

