let stopRun = true;

chrome.runtime.onMessage.addListener(
    async function (request, sender, sendResponse) {
        let message = "";

        if (request.command == "stop") {
            console.log("Received stop signal");
            stopRun = true;
        } else if (request.command == "extract") {
            extract(request.debug, sendResponse, request.deliveryChk, request.addressChk);
        }
    }
);

function extract(isDebug, sendResponse, includeDelivery, includeAddress) {
    try {
        stopRun = false;
        let orderDate = "";
        let orderId = "";
        let result = "";
        let orderExpressName = "";
        let orderExpressId = "";
        let orderDeliveryStatus = "";
        let orderPaidAmount = "获取失败";
        let orderDeliveryAddress = "";
        let orderItemName = "";
        let orderMoreParcleHighlight = "";
        let isOrderTmall = false;

        let orderRoot = document.getElementById("tp-bought-root");
        let orderElements = orderRoot.getElementsByClassName("js-order-container");
        // let orderElements = orderRoot.getElementsByClassName("index-mod__order-container___1ur4- js-order-container");

        if (orderElements.length == 0) {
            message = "当前页面没有找到订单";
            sendResponse({ message: message, success: false });
            return;
        }


        let processedCount = 0;

        for (let index = 0; index < orderElements.length && !stopRun; index++) {
            processedCount++;
            orderMoreParcleHighlight = "";
            orderDeliveryStatus = "";
            orderId = "";
            orderDate = "";

            let bodies = orderElements[index].getElementsByTagName("tbody");
            let orderIdCell = bodies[0].getElementsByTagName("td")[0].textContent;
            orderDate = orderIdCell.substring(0, 10);
            orderId = orderIdCell.substring(orderIdCell.indexOf("订单号") + 4);
            console.log("Processing Order ID: " + orderId);

            let tmallCell = bodies[0].getElementsByTagName("td")[1].getElementsByTagName("img");

            if (tmallCell != undefined && tmallCell.length > 0) {
                isOrderTmall = true;


                // Tmall icon: //gtd.alicdn.com/tps/i2/TB1aJQKFVXXXXamXFXXEDhGGXXX-32-32.png
                // Enterprise icon: //img.alicdn.com/gtd.alicdn.com(trade)/tps/i2/TB1Yta.HVXXXXX3XFXXAz6UFXXX-16-16.png
                if (tmallCell[0].src.indexOf("trade") > -1) {
                    console.log("orderID: " + orderId + " is not Tmall");
                    isOrderTmall = false;
                }
            } else {
                console.log("orderID: " + orderId + " is not Tmall");
                isOrderTmall = false;
            }




            let itemRows = bodies[1].getElementsByTagName("tr");
            let cells = itemRows[0].getElementsByTagName("td");
            orderItemName = cells[0].innerText;
            let cutIndex = orderItemName.indexOf("[交易快照]");
            if (cutIndex < 0) {
                cutIndex = orderItemName.indexOf("\n");
            }

            if (cutIndex > 0) {
                orderItemName = orderItemName.substring(0, cutIndex);
            }

            let remainingItemsCount = itemRows.length - 1;

            if (remainingItemsCount > 0) {
                if (itemRows[itemRows.length - 1].getElementsByTagName("td")[0].innerText == "保险服务") {
                    remainingItemsCount--;
                }

                if (remainingItemsCount > 0) {
                    orderItemName = orderItemName + " --及其他" + (itemRows.length - 2) + "件物品"
                }
            }

            chrome.runtime.sendMessage({ item: orderItemName, orderId: orderId, event: "processItem" });


            var priceEle = cells[4].getElementsByTagName('strong');

            if (priceEle != null) {
                orderPaidAmount = priceEle[0].textContent.replace("￥", "");
            }

            if (includeAddress) {
                orderDeliveryAddress = "获取失败";
                let shortTransportLink = "";
                if (isOrderTmall) {
                    shortTransportLink = "https://trade.tmall.com/detail/orderDetail.htm?bizOrderId=" + orderId;
                } else {
                    shortTransportLink = "https://trade.taobao.com/trade/detail/trade_item_detail.htm?bizOrderId=" + orderId;
                }

                let transportResponse = getSyncUrlResponse(shortTransportLink);
                if (isDebug) {
                    console.log("address response: ", transportResponse);
                }

                if (transportResponse != "") {
                    if (transportResponse.indexOf("包裹2") != -1) {
                        orderMoreParcleHighlight = "此订单有额外包裹，请手动核实添加";
                    }

                    if (isOrderTmall) {
                        orderDeliveryAddress = getTmallOrderAddress(isDebug, transportResponse);
                    } else {
                        orderDeliveryAddress = getNonTmallOrderAddress(isDebug, transportResponse);
                    }



                }

            }

            if (includeDelivery) {
                let shortTransportLink = "https://buyertrade.taobao.com/trade/json/transit_step.do?bizOrderId=" + orderId;
                // let shortTransportLink = "https://detail.i56.taobao.com/call/queryTrace.do?dimension=TRADE_ID&tradeId=" + orderId;

                let transportResponse = getSyncUrlResponse(shortTransportLink);

                if (transportResponse.indexOf("签收") > 0) {
                    orderDeliveryStatus = "已签收";
                }

                if (isDebug) {
                    console.log("transport response: ", transportResponse)
                }

                transportResponse = JSON.parse(transportResponse);

                orderExpressName = transportResponse["expressName"] ?? "无记录";
                orderExpressId = transportResponse["expressId"] ?? "无记录";
            }

            // result = result + orderDate + "\t" + orderId + "\t" + orderItemName + "\t" + orderPaidAmount + "\t" + (0-orderPaidAmount) + "\t" + orderExpressName + "\t" + orderExpressId + "\t" + orderDeliveryStatus + "\t" + orderDeliveryAddress + "\t" + orderMoreParcleHighlight + "\n";
            // result = result + orderDate + ", " + orderId + ", " + orderExpressName + ", " + orderExpressId + ", " + orderItemName + ", " + orderPaidAmount + ", " + orderDeliveryStatus + ", " + orderDeliveryAddress + ", " + orderMoreParcleHighlight + "\n";
            result = result + processedCount + "\t" + orderExpressName + "\t ’" + orderExpressId + "\t" + orderItemName + "\t" + orderPaidAmount + "\t" + orderDeliveryStatus + "\t" + orderMoreParcleHighlight + "\n";
        }

        copyTextToClipboard(result);
        if (isDebug) {
            console.log(result)
        }
        message = "已处理" + processedCount + "条记录，一共" + orderElements.length + "条。";
        sendResponse({ message: message, success: true });
    } catch (e) {
        console.error(e);
        message = "未知错误";
        sendResponse({ message: message, success: false });
    }
}

function getTmallOrderAddress(isDebug, detailsHtml) {
    let lines = detailsHtml.split("\n");
    for (var i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (line.indexOf("var detailData =") != -1) {
            if (isDebug) {
                console.log('Address Line:');
                console.log(line);
            }

            if (line.indexOf("FAIL_SYS_USER_VALIDATE") > -1) {
                return "命中手工验证，无法获取。如果订单少，请手动获取；如果订单多，请在淘宝手动点击订单详情并完成人工认证后，再重新运行此插件。"
            }

            line = line.replace("var detailData =", "");

            let orderDetails = JSON.parse(line);
            let basics = orderDetails.basic.lists;

            for (var j = 0; j < basics.length; j++) {
                let basic = basics[j];
                if (basic.key == "收货地址") {
                    return basic.content[0].text;
                }
            }
        }
    }

    return "获取失败";
}

function getNonTmallOrderAddress(isDebug, detailsHtml) {
    let lines = detailsHtml.split("\n");
    for (var i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (line.indexOf("var data = JSON.parse('") != -1) {
            if (isDebug) {
                console.log('Address Line:');
                console.log(line);
            }

            if (line.indexOf("FAIL_SYS_USER_VALIDATE") > -1) {
                return "命中手工验证，无法获取。如果订单少，请手动获取；如果订单多，请在淘宝手动点击订单详情并完成人工认证后，再重新运行此插件。"
            }

            line = line.replace("var data = JSON.parse('", "");
            line = line.substring(0, line.length - 3);
            line = line.trim();

            line = line.replace(/([{,:\[])\\"/gi, '$1"');
            line = line.replace(/\\"([}:,\]])/gi, '"$1');

            if (isDebug) {
                console.log('Address Line （after replacing):');
                console.log(line);
            }

            let orderDetails = JSON.parse(line);
            return orderDetails.deliveryInfo.address;

        }
    }

    return "获取失败";
}

function getSyncUrlResponse(url) {
    var xhr = new XMLHttpRequest();

    xhr.withCredentials = true;

    try {
        xhr.open("GET", url, false);
        /*xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) {
                return xhr.responseText;
            }
        }*/

        xhr.send();
        return xhr.responseText;
    } catch (e) {
        console.error(e);
        return "";
    }

}

function getTagMatchingClass(root, tag, classRegex) {
    var all_divs = root.getElementsByTagName(tag);
    for (var i = 0; i < all_divs.length; i++) {
        var div = all_divs[i];

        if (div.className.match(classRegex)) {
            return div;
        }
    }

    return null;
}


function copyTextToClipboard(text) {
    var copyFrom = document.createElement("textarea");
    copyFrom.textContent = text;
    document.body.appendChild(copyFrom);
    copyFrom.select();
    document.execCommand('copy');
    copyFrom.blur();
    document.body.removeChild(copyFrom);
}